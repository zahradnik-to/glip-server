const router = require('express').Router();

const {
  addMinutes, addDays, subHours, isPast, addHours,
} = require('date-fns');
const { body, validationResult } = require('express-validator');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');
const ProcedureModel = require('../models/procedureModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole, verifyAuthor } = require('../middleware/isAuthorized');
const { userRoles, RoleModel } = require('../models/roleModel');
const { verifyRoleOrAuthor } = require('../middleware/isAuthorized');

const WORK_TIME_BEGIN = 7;
const WORK_TIME_END = 17;
const APPOINTMENT_GRANULARITY_MINUTES = 15;

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
      console.log(errors.array());
      return res.status(500).json({ message: 'Neplatný formulář.', errors: errors.array() });
    }

    const event = req.body;
    if (isPast(new Date(event.date))) return res.status(500).json('Nelze založit událost v minulosti.');

    // Find provided procedure
    let procedure;
    try {
      procedure = await ProcedureModel.findById({ _id: event.procedureId }).lean();
    } catch (err) {
      console.error(err);
      return res.status(404).json('Služba nenalazena.');
    }

    event.title = `${procedure.name}`;
    event.end = calculateEventEnd(event.start, procedure.duration).toISOString();
    event.canceled = false;
    if (req.isAuthenticated()) event.customerId = req.user._id;

    // Make sure the selected time is still not occupied or during vacation
    const { dateStart, dateEnd } = getDateStartEnd(event.start);
    let allEvents;
    try {
      allEvents = await getAllEvents(dateStart, dateEnd, event.typeOfService);
    } catch (err) {
      return res.sendStatus(500);
    }
    const freeTime = calculateFreeTime(new Date(dateStart), allEvents, procedure.duration);
    if (!freeTime.includes(event.eventTime)) return res.status(500).json('Termín byl již obsazen. Zkuste to znovu.');

    try {
      await EventModel(event).save();
      // If there is no more free time, create all day BC event.
      await checkRemainingFreeTime(event.date, event.typeOfService);
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
    // Only staff with role or author can update
    if (!verifyRoleOrAuthor(foundEvent.typeOfService, user, foundEvent.customerId)) return res.sendStatus(403);
    // User can only update notes
    if (!verifyRole(userRoles.STAFF, user)) {
      const result = await EventModel.findOneAndUpdate({ _id }, { notes: update.notes, phoneNumber: update.phoneNumber }, { new: true });
      return res.status(200).json(result.modifiedCount);
    }

    const { typeOfService } = foundEvent;
    if (!start) start = foundEvent.start;

    let duration;
    if (procedureId) {
      const newProcedure = await ProcedureModel.findById(procedureId).lean();
      duration = newProcedure.duration;
    } else {
      const newProcedure = await ProcedureModel.findById(foundEvent.procedureId).lean();
      duration = newProcedure.duration;
    }

    if (dateTimeChange || procedureId) {
      update.end = calculateEventEnd(start, duration).toISOString();
    }

    const result = await EventModel.updateOne({ _id }, update, { new: true });
    if (dateTimeChange) {
      // Delete occupied event from old day if exists
      await deleteOccupiedEvent(foundEvent.start, typeOfService);
      await checkRemainingFreeTime(start, typeOfService);
    } else {
      await checkRemainingFreeTime(foundEvent.start, typeOfService);
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
    if (allStudioEventsAreRequestedAndUserHasStaffRole(requestedStudio, req)) {
      if (userNotAdminOrHasDifferentRoleThanRequested(req, requestedStudio)) res.sendStatus(403);
      events = await getAllEventsForStudio(dtoIn, procedureList);
    } else {
      events = await getEventsForLoggedUser(dtoIn, procedureList, req.user);
    }
    // Map studio names to events
    const roleList = await RoleModel.find({ type: 'staffRole' }).lean();
    events = mapTypeOfServiceDisplayNameFromNameToEvents(events, roleList);
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

    let mappedEventList = mapProcedureNameFromIdToEvents(eventList, procedureList);
    const roleList = await RoleModel.find({ type: 'staffRole' }).lean();
    mappedEventList = mapTypeOfServiceDisplayNameFromNameToEvents(mappedEventList, roleList);

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
  EventModel.findById(_id, '_id title start end lastname email procedureId phoneNumber notes staffNotes typeOfService customerId canceled', (err, docs) => {
    if (err) return res.sendStatus(500);
    if (!verifyRoleOrAuthor(userRoles.STAFF, docs.typeOfService, req.user)) return res.sendStatus(403);
    // eslint-disable-next-line no-param-reassign
    if (!verifyRole(userRoles.STAFF, req.user)) delete docs.staffNotes;
    return res.status(200).json(docs);
  }).lean();
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
  const cancelCutoff = 24;
  try {
    const foundEvent = await EventModel.findById(_id).lean();
    // Users can cancel event only more than 24 hours
    const feStartDate = new Date(foundEvent.start);
    const prevDay = subHours(feStartDate, cancelCutoff);
    if ((isPast(feStartDate) || isPast(prevDay)) && !verifyRole(foundEvent.typeOfService, user)) return res.sendStatus(403);
    // Only let cancel admin, role-staff or user author
    if (!verifyRoleOrAuthor(foundEvent.typeOfService, user, foundEvent.customerId)) return res.sendStatus(403);
    if (!canceled && !verifyRole(foundEvent.typeOfService, user)) return res.sendStatus(403); // Only staff can un-cancel event

    const result = await EventModel.findByIdAndUpdate({ _id }, { canceled }, { new: true }).lean();
    await deleteOccupiedEvent(result.start, result.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

router.get('/get-free-time', async (req, res) => {
  const { dateStart, dateEnd } = getDateStartEnd(req.query.date);
  const { typeOfService, procedureId, eventId } = req.query;

  let procedure;
  try {
    procedure = await ProcedureModel.findById(procedureId).lean();
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  let allEvents;
  try {
    allEvents = await getAllEvents(dateStart, dateEnd, typeOfService);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }

  const freeTime = calculateFreeTime(new Date(dateStart), allEvents, procedure.duration, eventId);
  return res.status(200).json(freeTime);
});

/**
 * Checks remaining free time for a specific date, then creates or deletes occupied event accordingly.
 * @param date Date to be scanned. Time does not matter.
 * @param typeOfService
 * @returns {Promise<void>}
 */
async function checkRemainingFreeTime(date, typeOfService) {
  const { dateStart, dateEnd } = getDateStartEnd(date);
  const events = await getAllEvents(dateStart, dateEnd, typeOfService);
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
 * @param procedureDuration {Number} Duration of procedure being created.
 * @param eventId Only used when calculating for already existing event.ws
 * @returns {String[]} Array of strings representing free times for an appointment.
 */
function calculateFreeTime(date, events, procedureDuration, eventId = '') {
  const freeTime = [];
  const startTime = addHours(date, WORK_TIME_BEGIN).getTime();
  const endTime = addHours(date, WORK_TIME_END).getTime();
  const addMs = APPOINTMENT_GRANULARITY_MINUTES * 1e3 * 60;
  // Todo Fixme Lze prekrocit maximalni pracovni dobu

  for (let currTime = startTime; currTime < endTime; currTime += addMs) {
    if (isPast(new Date(currTime))) continue;

    const procedureStart = currTime;
    const procedureEnd = addMinutes(new Date(currTime), procedureDuration).getTime();
    const eventExists = (e) => (e._id.toString() !== eventId) && ( // Prevent event from blocking itself when editing time
      (Date.parse(e.start) >= procedureStart && Date.parse(e.start) < procedureEnd) // Found event starts in procedure interval
      || (Date.parse(e.end) > procedureStart && Date.parse(e.end) < procedureEnd)); // Found event end in procedure interval

    const foundEvent = events.find((eventExists));
    if (foundEvent) {
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
  const addMs = APPOINTMENT_GRANULARITY_MINUTES * 1e3 * 60;
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
 * @param typeOfService
 * @param showCanceled
 * @returns {Promise<*[]>}
 */
async function getAllEvents(start, end, typeOfService, showCanceled = false) {
  const events = await EventModel.find({
    start: { $gte: start },
    end: { $lte: end },
    canceled: showCanceled,
    typeOfService,
  }).lean();
  const staffEvents = await StaffEventModel.find({
    start: { $gte: start },
    end: { $lte: end },
    typeOfService,
  }).lean();

  return [...events, ...staffEvents];
}

function allStudioEventsAreRequestedAndUserHasStaffRole(requestedStudio, req) {
  return requestedStudio && verifyRole(userRoles.STAFF, req.user);
}

function userNotAdminOrHasDifferentRoleThanRequested(req, requestedStudio) {
  return !req.user.isAdmin && requestedStudio !== req.user.role;
}

async function getAllEventsForStudio(dtoIn, procedureList) {
  const events = await getAllEvents(
    new Date(dtoIn.start).toISOString(),
    new Date(dtoIn.end).toISOString(),
    dtoIn.typeOfService,
    dtoIn?.showCanceled,
  );
  return mapProcedureNameFromIdToEvents(events, procedureList);
}

async function getEventsForLoggedUser(dtoIn, procedureList, user) {
  const events = await EventModel.find({
    start: { $gte: new Date(dtoIn.start).toISOString() },
    end: { $lte: new Date(dtoIn.end).toISOString() },
    canceled: false,
    customerId: user._id,
  }).lean();
  return mapProcedureNameFromIdToEvents(events, procedureList);
}

function mapProcedureNameFromIdToEvents(eventList, procedureList) {
  // Create a map of [procedureID, procedureName]
  const proceduresMap = new Map(procedureList.map((p) => [p._id.toString(), p.name]));
  // Map procedure names to events based on procedureId
  return eventList.map((e) => ({ ...e, procedureName: proceduresMap.get(e.procedureId) }));
}

function mapTypeOfServiceDisplayNameFromNameToEvents(eventList, roleList) {
  // Create a map of [procedureID, procedureName]
  const proceduresMap = new Map(roleList.map((r) => [r.name, r.displayName]));
  // Map procedure names to events based on procedureId
  return eventList.map((e) => ({ ...e, typeOfServiceName: proceduresMap.get(e.typeOfService) }));
}

module.exports = router;
