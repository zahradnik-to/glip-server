const router = require('express').Router();

const {
  addMinutes, addDays, subHours, subMinutes, isPast, addHours,
} = require('date-fns');
const { body, validationResult } = require('express-validator');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');
const { ProcedureModel, PROCEDURE_DURATION_GRANULARITY } = require('../models/procedureModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole, verifyAuthor } = require('../middleware/isAuthorized');
const { userRoles, RoleModel } = require('../models/roleModel');
const { verifyRoleOrAuthor } = require('../middleware/isAuthorized');
const UserModel = require('../models/userModel');

const WORK_TIME_BEGIN = 7;
const WORK_TIME_END = 17;
const EVENT_MODIFICATION_CUTOFF_HRS = 24;
const USER_EVENT_ALLOWED_FIELDS = '_id title start end lastname email procedureId phoneNumber notes typeOfService customerId canceled price duration extraPrice extraDuration';

/**
 * Takes values from client form, validates, sanitizes them and creates new event in Mongo.
 * @return Object On resolve returns an object of saved document
 */
router.post(
  '/create-event',
  body('email').isEmail().normalizeEmail(),
  body('lastname').isLength({ min: 2 }),
  body('procedureId').isMongoId(),
  body('typeOfService').isString(),
  body('date').isISO8601(),
  body('phoneNumber').isMobilePhone('cs-CZ'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(errors.array());
      return res.status(500).json({ message: 'Neplatný formulář.' });
    }

    const event = req.body;
    if (isPast(new Date(event.date))) return res.status(500).json('Nelze založit událost v minulosti.');

    // Find provided procedure and typeOfService/role
    let procedure;
    let role;
    try {
      procedure = await ProcedureModel.findById({ _id: event.procedureId }).lean();
      role = await RoleModel.findOne({ name: event.typeOfService }).lean();
    } catch (err) {
      console.error(err);
      return res.status(404).json('Služba nenalazena.');
    }

    event.title = `${procedure.name}`;
    event.end = calculateEventEnd(event.start, procedure.duration).toISOString();
    event.typeOfService = role.displayName;
    event.canceled = false;
    if (req.isAuthenticated()) event.customerId = req.user._id;

    // Set price and duration
    const { extraPrice, extraDuration } = calculateEventPriceAndDuration(event.selectedAddProcList);
    event.price = procedure.price;
    event.duration = procedure.duration;
    event.extraPrice = extraPrice;
    event.extraDuration = extraDuration;

    // Make sure the selected time is still not occupied or during vacation
    const { dateStart, dateEnd } = getDateStartEnd(event.start);
    let allEvents;
    try {
      allEvents = await getAllEvents(dateStart, dateEnd, '', false, role);
    } catch (err) {
      return res.sendStatus(500);
    }
    const freeTime = calculateFreeTime(new Date(dateStart), allEvents, procedure.duration);
    if (!freeTime.includes(event.eventTime)) return res.status(500).json('Termín byl již obsazen. Zkuste to znovu.');

    try {
      await EventModel(event).save();

      if (req.isAuthenticated()) await saveUsersPhoneNumber(req.user._id, event.phoneNumber);

      // If there is no more free time, create all day BC event.
      await checkRemainingFreeTime(event.date, '', role);
      return res.status(201).json(event);
    } catch (err) {
      console.error(err);
      return res.status(500).send(err.toString());
    }
  },
);

router.put('/update-event', isAuth, async (req, res) => {
  const { user } = req;
  const update = req.body;
  const {
    _id, dateTimeChange, procedureId,
  } = update;
  let { start } = update;
  try {
    const foundEvent = await EventModel.findById(_id).lean();
    const eventProcedure = await ProcedureModel.findById(foundEvent.procedureId).lean();
    const typeOfServiceName = eventProcedure.typeOfService;

    // Only staff with role or author can update
    if (!verifyRoleOrAuthor(foundEvent.typeOfService, user, foundEvent.customerId)) return res.sendStatus(403);
    // User can only update notes
    if (!verifyRole(userRoles.STAFF, user)) {
      const result = await EventModel.findOneAndUpdate({ _id }, { notes: update.notes, phoneNumber: update.phoneNumber }, { new: true });
      return res.status(200).json(result.modifiedCount);
    }

    let { duration } = eventProcedure;
    if (procedureId) {
      const newProcedure = await ProcedureModel.findById(procedureId).lean();
      duration = newProcedure.duration + foundEvent.extraDuration;
      update.duration = duration;
    }

    if (!start) start = foundEvent.start;
    if (dateTimeChange || procedureId) {
      update.end = calculateEventEnd(start, duration).toISOString();
    }

    const result = await EventModel.updateOne({ _id }, update, { new: true });
    if (dateTimeChange) {
      // Delete occupied event from old day if exists
      await deleteOccupiedEvent(foundEvent.start, typeOfServiceName);
      await checkRemainingFreeTime(start, typeOfServiceName);
    } else {
      await checkRemainingFreeTime(foundEvent.start, typeOfServiceName);
    }
    return res.status(200).json(result.modifiedCount);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.put('/update-staff-event', isAuth, async (req, res) => {
  const { _id } = req.body;
  const { user } = req;
  try {
    const foundEvent = await StaffEventModel.findById(_id).lean();
    if (!verifyAuthor(user, foundEvent.staffId)) return res.sendStatus(403);

    const result = await StaffEventModel.findOneAndUpdate({ _id }, req.body, { new: true });
    return res.status(200).json(result);
  } catch (err) {
    console.warn('staff-event/update error');
    console.error(err);
    return res.status(500).json(err);
  }
});

router.post('/create-staff-event', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.STAFF, req.user)) return res.sendStatus(403);
  const event = req.body;
  event.staffId = req.user._id.toString();
  try {
    await StaffEventModel(event).save();
    await checkRemainingFreeTime(req.body.start, req.body.typeOfService);
    return res.status(201).json(event);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

router.get('/get-events', isAuth, async (req, res) => {
  let events;
  const dtoIn = req.query;
  const requestedStudio = req.query.typeOfService;
  try {
    const procedureList = await ProcedureModel.find().lean();
    if (allStudioEventsAreRequestedAndUserHasStudioRole(requestedStudio, req)) {
      events = await getAllEventsForStudio(dtoIn);
    } else {
      events = await getEventsForLoggedUser(dtoIn, req.user);
    }
    events = mapProcedureNameFromIdToEvents(events, procedureList);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
  return res.status(200).json(events);
});

router.get('/get-events-page', isAuth, async (req, res) => {
  let requestedPage = req.query.page;
  if (!requestedPage) requestedPage = 1;
  const paginateOptions = {
    page: requestedPage,
    limit: 10,
    sort: { start: 'desc' },
    customLabels: {
      docs: 'events',
    },
  };

  let paginateEvents;
  try {
    const procedureList = await ProcedureModel.find().lean();
    paginateEvents = await EventModel.paginate({ customerId: req.user._id }, paginateOptions);
    const eventList = paginateEvents.events.map((e) => e.toObject());

    const mappedEventList = mapProcedureNameFromIdToEvents(eventList, procedureList);

    // if (!verifyRole(userRoles.STAFF, req.user)) {
    //   mappedEventList = mappedEventList.map((e) => delete e?.staffNotes);
    // }

    // Replace events with mapped plain object event list
    paginateEvents.events = mappedEventList;
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  return res.status(200).json(paginateEvents);
});

router.get('/get-bg-events', async (req, res) => {
  let events;
  const { start, end, typeOfService } = req.query;
  try {
    events = await StaffEventModel.find({
      start: { $gte: start },
      end: { $lte: end },
      typeOfService,
    }, 'start end allDay display').lean();
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  return res.status(200).json(events);
});

router.get('/get-event', isAuth, async (req, res) => {
  const { _id } = req.query;

  try {
    const foundEvent = await EventModel.findById(_id, `${USER_EVENT_ALLOWED_FIELDS} staffNotes`).lean();
    const eventProcedure = await ProcedureModel.findById(foundEvent.procedureId).lean();
    if (!verifyRoleOrAuthor(eventProcedure.typeOfService, req.user, foundEvent.customerId)) return res.sendStatus(403);

    // eslint-disable-next-line no-param-reassign
    if (!verifyRole(userRoles.STAFF, req.user)) delete foundEvent.staffNotes;
    return res.status(200).json(foundEvent);
  } catch (e) {
    return res.sendStatus(500);
  }
});

router.get('/get-staff-event', isAuth, async (req, res) => {
  const { _id } = req.query;
  if (!verifyRole(userRoles.STAFF, req.user)) return res.sendStatus(403);
  StaffEventModel.findById(_id, (err, docs) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    return res.status(200).json(docs);
  }).lean();
  return res.status(500);
});

router.delete('/delete-staff-event', isAuth, async (req, res) => {
  const { _id } = req.body;
  try {
    const foundEvent = await StaffEventModel.findById(_id).lean();
    if (!verifyAuthor(req.user, foundEvent.staffId)) return res.sendStatus(403);

    const result = await StaffEventModel.deleteOne({ _id });
    await deleteOccupiedEvent(new Date(foundEvent.start), foundEvent.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

router.delete('/delete-event', isAuth, async (req, res) => {
  const { _id } = req.body;
  try {
    const foundEvent = await EventModel.findById(_id).lean();
    if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

    const result = await EventModel.deleteOne({ _id });
    await deleteOccupiedEvent(foundEvent.start, foundEvent.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

router.put('/cancel-event', isAuth, async (req, res) => {
  const { _id, canceled } = req.body;
  const { user } = req;

  try {
    const foundEvent = await EventModel.findById(_id).lean();
    if (!foundEvent) return res.status(500).send('Event not found');
    const eventProcedure = 1;

    // Users can cancel event only >24 hours
    const evtStartDate = new Date(foundEvent.start);
    const evtModificationCutoff = subHours(evtStartDate, EVENT_MODIFICATION_CUTOFF_HRS);
    if ((isPast(evtStartDate) || isPast(evtModificationCutoff)) && !verifyRole(eventProcedure.typeOfService, user)) return res.sendStatus(403);

    // Only let cancel admin, role-staff or user author
    if (!verifyRoleOrAuthor(eventProcedure.typeOfService, user, foundEvent.customerId)) return res.sendStatus(403);
    if (!canceled && !verifyRole(eventProcedure.typeOfService, user)) return res.sendStatus(403); // Only staff can un-cancel event

    const result = await EventModel.findByIdAndUpdate({ _id }, { canceled }, { new: true }).lean();
    await deleteOccupiedEvent(result.start, eventProcedure.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

router.get('/get-free-time', async (req, res) => {
  const { dateStart, dateEnd } = getDateStartEnd(req.query.date);
  const {
    typeOfService, procedureId, eventId, duration,
  } = req.query;

  let procedure;
  try {
    procedure = await ProcedureModel.findById(procedureId).lean();
    if (!procedure) return res.sendStatus(500);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  let allEvents;
  try {
    allEvents = await getAllEvents(dateStart, dateEnd, procedure.typeOfService);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  const freeTime = calculateFreeTime(new Date(dateStart), allEvents, duration, eventId);
  return res.status(200).json(freeTime);
});

function calculateEventPriceAndDuration(additionalProcedures) {
  const extraPrice = additionalProcedures.reduce((total, proc) => total + proc.price, 0);
  const extraDuration = additionalProcedures.reduce((total, proc) => total + proc.duration, 0);

  return { extraPrice, extraDuration };
}

/**
 * Checks remaining free time for a specific date, then creates or deletes occupied event accordingly.
 * @param date Date to be scanned. Time does not matter.
 * @param typeOfService
 * @returns {Promise<void>}
 */
async function checkRemainingFreeTime(date, typeOfService, role = {}) {
  const { dateStart, dateEnd } = getDateStartEnd(date);
  const events = await getAllEvents(dateStart, dateEnd, typeOfService, false, role);
  const isBooked = isFullyBooked(new Date(dateStart), events);
  if (isBooked) {
    // No free time, add booked event
    await StaffEventModel({
      start: dateStart,
      end: dateEnd,
      allDay: true,
      display: 'background',
      typeOfService,
      eventType: 'occupied',
    }).save();
  }
}

/**
 * Deletes occupied background event from a date.
 * @param date
 * @param typeOfService
 * @returns {Promise<*>}
 */
async function deleteOccupiedEvent(date, typeOfService) {
  const { dateStart, dateEnd } = getDateStartEnd(date);
  const deleteCriteria = {
    start: { $gte: dateStart },
    end: { $lte: dateEnd },
    eventType: 'occupied',
    typeOfService,
  };
  return StaffEventModel.findOneAndDelete(deleteCriteria);
}

/**
 * Returns ISO string of the beginning and end of a provided date.
 * @param date Day for which we need start and end.
 * @returns {{dateStart: string, dateEnd: string}}
 */
function getDateStartEnd(date) {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0); // 2 lines to keep dateStart as Date obj
  return {
    dateStart: dateStart.toISOString(),
    dateEnd: addDays(dateStart, 1).toISOString(),
  };
}

function calculateEventEnd(start, duration) {
  return new Date(addMinutes(new Date(start), duration));
}

/**
 * Returns free time for an appointment based on events in DB.
 * @param date
 * @param events {Object[]} of events to look through.
 * @param reservationDuration {Number} Duration of procedure being created.
 * @param eventId Only used when calculating for already existing event.ws
 * @returns {String[]} Array of strings representing free times for an appointment.
 */
function calculateFreeTime(date, events, reservationDuration, eventId = '') {
  const freeTime = [];
  const startTime = addHours(date, WORK_TIME_BEGIN).getTime();
  let endTime = addHours(date, WORK_TIME_END);
  endTime = subMinutes(endTime, reservationDuration - 1).getTime(); // Work time exceed protection
  const addMs = PROCEDURE_DURATION_GRANULARITY * 1e3 * 60;

  for (let currTime = startTime; currTime < endTime; currTime += addMs) {
    if (isPast(new Date(currTime))) continue;

    const procedureStart = currTime;
    const procedureEnd = addMinutes(new Date(currTime), reservationDuration).getTime();
    const eventExists = (e) => (e._id.toString() !== eventId) && ( // Prevent event from blocking itself when editing time
      (Date.parse(e.start) >= procedureStart && Date.parse(e.start) < procedureEnd) // Found event starts in procedure interval
      || (Date.parse(e.end) > procedureStart && Date.parse(e.end) < procedureEnd)); // Found event end in procedure interval

    const foundEvent = events.find((eventExists));
    if (foundEvent) {
      // Skip iteration to end of found event
      currTime = foundEvent.end.getTime() - addMs;
      continue;
    }

    freeTime.push(new Date(currTime).toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
  }
  return freeTime;
}

/**
 * Checks if provided date is fully occupied with events.
 * @param date
 * @param events {Object[]} Array of events to look through.
 * @returns {boolean}
 */
function isFullyBooked(date, events) {
  const startTime = addHours(date, WORK_TIME_BEGIN).getTime();
  const endTime = addHours(date, WORK_TIME_END).getTime();
  const addMs = PROCEDURE_DURATION_GRANULARITY * 1e3 * 60;
  for (let currTime = startTime; currTime < endTime; currTime += addMs) {
    if (isPast(new Date(currTime))) continue;

    const eventExists = (e) => Date.parse(e.start) <= currTime && Date.parse(e.end) > currTime;
    const foundEvent = events.find((eventExists));
    if (foundEvent) {
      currTime = foundEvent.end.getTime() - addMs;
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Gathers regular and staff events and returns them in an array.
 * @param start
 * @param end
 * @param typeOfService {string} DisplayName of role
 * @param showCanceled {boolean}
 * @param roleObj {Object}
 * @returns {Promise<*[]>}
 */
async function getAllEvents(start, end, typeOfService, showCanceled = false, roleObj = {}) {
  const tosName = await determineTosName(roleObj, typeOfService);
  const events = await EventModel.find({
    start: { $gte: start },
    end: { $lte: end },
    canceled: showCanceled,
    typeOfService: tosName,
  }).lean();
  const staffEvents = await StaffEventModel.find({
    start: { $gte: start },
    end: { $lte: end },
    typeOfService: tosName,
  }).lean();

  return [...events, ...staffEvents];
}

async function determineTosName(roleObj, typeOfService) {
  if (Object.keys(roleObj).length === 0) {
    return (await RoleModel.findOne({ name: typeOfService }).lean()).displayName;
  }
  return roleObj.displayName;
}

function allStudioEventsAreRequestedAndUserHasStudioRole(requestedStudio, req) {
  return requestedStudio && verifyRole(requestedStudio, req.user);
}

async function getAllEventsForStudio(dtoIn) {
  return getAllEvents(
    new Date(dtoIn.start).toISOString(),
    new Date(dtoIn.end).toISOString(),
    dtoIn.typeOfService,
    dtoIn?.showCanceled,
  );
}

async function getEventsForLoggedUser(dtoIn, user) {
  return EventModel.find({
    start: { $gte: new Date(dtoIn.start).toISOString() },
    end: { $lte: new Date(dtoIn.end).toISOString() },
    canceled: false,
    customerId: user._id,
  }, USER_EVENT_ALLOWED_FIELDS).lean();
}

function mapProcedureNameFromIdToEvents(eventList, procedureList) {
  // Create a map of [procedureID, procedureName]
  const proceduresMap = new Map(procedureList.map((p) => [p._id.toString(), p.name]));
  // Map procedure names to events based on procedureId
  return eventList.map((e) => ({ ...e, procedureName: proceduresMap.get(e.procedureId) }));
}

async function saveUsersPhoneNumber(_id, phoneNumber) {
  await UserModel.findByIdAndUpdate({ _id }, { phoneNumber }, { new: true }).lean();
}

module.exports = router;
