const router = require('express').Router();

const { addMinutes, addDays, isPast } = require('date-fns');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');

// Todo make this customizable?
const WORK_TIME_BEGIN = 8;
const WORK_TIME_DURATION_HOURS = 8;
const APPOINTMENT_GRANULARITY_MINUTES = 30;

/**
 * Takes values from client form, fills missing parameters, saves to Mongo.
 * @return Object On resolve returns an object of saved document
 */
router.post('/create-event', async (req, res) => {
  const event = req.body;
  event.title = `${event.lastname}`;
  event.end = calculateEventEnd(event.start, event.duration).toISOString();
  const { dateStart, dateEnd } = getDateStartEnd(req.body.date);
  console.log(req.user);
  if (req.user) event.customerId = req.user._id;

  try {
    await EventModel(event).save();
    // If there is no more free time, create all day BC event.
    // Todo make the opposite for event deletion and update
    const events = await getAllEvents(dateStart, dateEnd, req.body.typeOfService);
    const freeTime = calculateFreeTime(new Date(dateStart), events, true);
    if (!freeTime.length) {
      await StaffEventModel({
        title: 'Obsazeno',
        start: dateStart,
        end: dateEnd,
        allDay: true,
        display: 'background',
        typeOfService: req.body.typeOfService,
      }).save();
    }
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

router.put('/update-event', async (req, res) => {
  const update = req.body;
  const {
    _id, start, dateChange,
  } = update;
  try {
    const foundEvent = await EventModel.findById(_id).lean();

    let duration;
    if (update.duration) duration = update.duration;
    else duration = foundEvent.duration;

    if (dateChange) update.end = calculateEventEnd(start, duration).toISOString();

    const result = await EventModel.updateOne({ _id }, update, { new: true });
    res.status(200).json(result.modifiedCount);
  } catch (err) {
    console.warn('event/update error');
    console.error(err);
    res.status(500).send(err.toString());
  }
});

router.put('/update-staff-event', async (req, res) => {
  const { _id } = req.body;
  try {
    const staffEvent = await StaffEventModel.findById(_id);
    console.log(staffEvent);
    const result = await StaffEventModel.findOneAndUpdate({ _id }, req.body, { new: true });
    res.status(200).json(result);
  } catch (err) {
    console.warn('staff-event/update error');
    console.error(err);
    res.status(500).send(err.toString());
  }
});

router.post('/create-vacation', async (req, res) => {
  const event = req.body;
  try {
    await StaffEventModel(event).save();
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});

router.get('/get-events', async (req, res) => {
  let allEvents;
  try {
    allEvents = await getAllEvents(
      new Date(req.query.start).toISOString(),
      new Date(req.query.end).toISOString(),
      req.query.tos,
    );
    res.status(200).json(allEvents);
  } catch (err) {
    console.error(err);
  }
});

router.get('/get-event', async (req, res) => {
  const { _id } = req.query;
  EventModel.findById(_id, (err, docs) => {
    if (err) {
      console.error(err);
      res.status(500).json(err);
    } else {
      res.status(200).json(docs);
    }
  }).lean();
});

router.get('/get-staff-event', async (req, res) => {
  const { _id } = req.query;
  StaffEventModel.findById(_id, (err, docs) => {
    if (err) {
      console.log(err);
      res.status(500).json(err);
    } else {
      res.status(200).json(docs);
    }
  }).lean();
});

/**
 * @date UTC ISO String of a date for which to search free time.
 * @returns Array of free times as strings.
 */
router.get('/get-free-time', async (req, res) => {
  const { dateStart, dateEnd } = getDateStartEnd(req.query.date);
  const typeOfService = req.query.tos;

  let allEvents;
  try {
    allEvents = await getAllEvents(dateStart, dateEnd, typeOfService);
  } catch (err) {
    console.error(err);
  }

  const date = new Date(req.query.date);
  const freeTime = calculateFreeTime(date, allEvents);
  res.json(freeTime);
});

function getDateStartEnd(date) {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0); // 2 lines to keep dateStart as Date obj
  return {
    dateStart: new Date(dateStart).toISOString(),
    dateEnd: addDays(new Date(date), 1).toISOString(),
  };
}

async function getAllEvents(start, end, typeOfService) {
  const events = await EventModel.find({
    start: { $gte: start },
    end: { $lte: end },
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
  for (let minutes = 0; minutes < WORK_TIME_DURATION_HOURS * 60; minutes += APPOINTMENT_GRANULARITY_MINUTES) {
    date.setHours(WORK_TIME_BEGIN);
    date.setMinutes(minutes);
    if (isPast(date)) continue;

    const eventExists = (e) => Date.parse(e.start) <= date.getTime() && Date.parse(e.end) > date.getTime();
    const foundEvent = events.find((eventExists));
    if (foundEvent) {
      minutes += (foundEvent.duration - APPOINTMENT_GRANULARITY_MINUTES);
      continue;
    }

    freeTime.push(date.toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
    if (fullyBookedCheck) return freeTime;
  }
  return freeTime;
}

module.exports = router;
