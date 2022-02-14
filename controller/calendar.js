const router = require('express').Router();

const {
  addMinutes, addDays, isPast, addHours,
} = require('date-fns');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');
const ProcedureModel = require('../models/procedureModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole, verifyAuthor } = require('../middleware/isAuthorized');
const { STAFF } = require('../models/roleModel');
const { verifyRoleOrAuthor } = require('../middleware/isAuthorized');

// Todo make this customizable?
const WORK_TIME_BEGIN = 7;
const WORK_TIME_END = 17;
const APPOINTMENT_GRANULARITY_MINUTES = 15;

/**
 * Takes values from client form, fills missing parameters, saves to Mongo.
 * @return Object On resolve returns an object of saved document
 */
router.post('/create-event', async (req, res) => {
  const event = req.body;
  const procedure = await ProcedureModel.findById({ _id: event.procedureId }).lean();

  event.title = `${event.lastname}`;
  event.end = calculateEventEnd(event.start, procedure.duration).toISOString();

  if (req.isAuthenticated()) event.customerId = req.user._id;

  try {
    await EventModel(event).save();
    // If there is no more free time, create all day BC event.
    await checkRemainingFreeTime(req.body.date, req.body.typeOfService);
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

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
    //  Check old date, check new date
    return res.status(200).json(result.modifiedCount);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.toString());
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
    return res.status(500).send(err.toString());
  }
});

router.post('/create-staff-event', isAuth, async (req, res) => {
  const event = req.body;
  if (!verifyRole(STAFF, req.user)) return res.sendStatus(403);
  event.staffId = req.user._id;
  try {
    await StaffEventModel(event).save();
    await checkRemainingFreeTime(req.body.start, req.body.typeOfService);
    return res.status(201).json(event);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/get-events', isAuth, async (req, res) => {
  let events;
  try {
    if (verifyRole(STAFF, req.user)) {
      events = await getAllEvents(
        new Date(req.query.start).toISOString(),
        new Date(req.query.end).toISOString(),
        req.query.typeOfService,
        req.query.showCanceled,
      );
    } else {
      events = await EventModel.find({
        start: { $gte: new Date(req.query.start).toISOString() },
        end: { $lte: new Date(req.query.end).toISOString() },
        canceled: false,
        customerId: req.user._id,
      }).lean();
    }
    return res.status(200).json(events);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/get-event', isAuth, async (req, res) => {
  const { _id } = req.query;
  EventModel.findById(_id, (err, docs) => {
    if (err) return res.status(500).json(err);
    if (!verifyRole(docs.typeOfService, req.user)) return res.sendStatus(403);
    return res.status(200).json(docs);
  }).lean();
});

router.get('/get-staff-event', isAuth, async (req, res) => {
  const { _id } = req.query;
  if (!verifyRole(STAFF, req.user)) return res.sendStatus(403);
  StaffEventModel.findById(_id, (err, docs) => {
    if (err) return res.status(500).json(err);
    return res.status(200).json(docs);
  }).lean();
});

router.delete('/delete-staff-event', isAuth, async (req, res) => {
  const { _id } = req.body;
  const { user } = req;
  try {
    const foundEvent = await StaffEventModel.findOne({ _id }).lean();
    if (!foundEvent) return res.sendStatus(404);
    if (!user.isAdmin && foundEvent.staffId !== user._id) return res.sendStatus(403);

    const result = await StaffEventModel.deleteOne({ _id });
    await deleteOccupiedEvent(new Date(foundEvent.start), foundEvent.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

router.delete('/delete-event', async (req, res) => {
  const { _id } = req.body;
  const { user } = req;
  try {
    const foundEvent = await EventModel.findOne({ _id }).lean();
    if (!foundEvent) return res.sendStatus(404);
    if (!user.isAdmin && foundEvent.staffId !== user._id) return res.sendStatus(403);

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
    // Only let cancel admin, role-staff or user author
    if (!user.isAdmin && (foundEvent.customerId !== user._id && foundEvent.typeOfService !== user.role)) return res.sendStatus(403);

    const result = await EventModel.findByIdAndUpdate({ _id }, { canceled }, { new: true }).lean();
    await deleteOccupiedEvent(result.start, result.typeOfService);
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

/**
 * @date UTC ISO String of a date for which to search free time.
 * @returns Array of free times as strings.
 */
router.get('/get-free-time', async (req, res) => {
  const { dateStart, dateEnd } = getDateStartEnd(req.query.date);
  const { typeOfService } = req.query;

  let allEvents;
  try {
    allEvents = await getAllEvents(dateStart, dateEnd, typeOfService);
  } catch (err) {
    console.error(err);
  }

  const freeTime = calculateFreeTime(new Date(dateStart), allEvents);
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
  const freeTime = calculateFreeTime(new Date(dateStart), events, true);
  if (!freeTime.length) {
    // No free time
    console.log(`No free time for ${dateStart}`);
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

async function deleteOccupiedEvent(date, typeOfService) {
  const { dateStart, dateEnd } = getDateStartEnd(date);
  const deleteCriteria = {
    start: { $gte: dateStart },
    end: { $lte: dateEnd },
    eventType: 'occupied',
    typeOfService,
  };
  await StaffEventModel.findOneAndDelete(deleteCriteria);
}

function getDateStartEnd(date) {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0); // 2 lines to keep dateStart as Date obj
  return {
    dateStart: dateStart.toISOString(),
    dateEnd: addDays(dateStart, 1).toISOString(),
  };
}

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

function calculateEventEnd(start, duration) {
  return new Date(addMinutes(new Date(start), duration));
}

/**
 * Returns free time for an appointment based on events in DB.
 * @param date
 * @param events Array of events to look through.
 * @param fullyBookedCheck If true, function will return first found free time indicating that selected date is not fully booked.
 * @returns {*[]} Array of strings representing free times for an appointment.
 */
function calculateFreeTime(date, events, fullyBookedCheck = false) {
  const freeTime = [];
  const startTime = addHours(date, WORK_TIME_BEGIN).getTime();
  const endTime = addHours(date, WORK_TIME_END).getTime();
  const addMs = APPOINTMENT_GRANULARITY_MINUTES * 1e3 * 60;
  for (let currTime = startTime; currTime < endTime; currTime += addMs) {
    if (isPast(date)) continue;

    const eventExists = (e) => Date.parse(e.start) <= currTime && Date.parse(e.end) > currTime;
    const foundEvent = events.find((eventExists));
    if (foundEvent) {
      currTime = foundEvent.end.getTime() - addMs;
      continue;
    }

    freeTime.push(new Date(currTime).toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
    if (fullyBookedCheck) return freeTime;
  }
  return freeTime;
}

module.exports = router;
