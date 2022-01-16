const router = require('express').Router();

const { addMinutes, addDays } = require('date-fns');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');

const WORK_TIME_BEGIN = 8;
const WORK_TIME_DURATION_HOURS = 8;
const APPOINTMENT_GRANULARITY_MINUTES = 30;

/**
 * Takes values from client form, fills missing parameters, saves to Mongo.
 * @return Object On resolve returns an object of saved document
 */
router.post('/create-event', async (req, res) => {
  const event = req.body;
  event.title = `${event.lastname} ${event.duration}min`;
  event.end = new Date(addMinutes(new Date(event.start), event.duration)).toISOString();

  try {
    await EventModel(event).save();
    res.status(201).json(event);
  } catch (err) {
    res.status(500).send(err.toString());
  }
  res.status(201).json(event);
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
  try {
    const events = await EventModel.find({
      start: { $gte: new Date(req.query.start).toISOString() },
      end: { $lte: new Date(req.query.end).toISOString() },
      typeOfService: req.query.tos,
    }).lean();
    const staffEvents = await StaffEventModel.find({
      start: { $gte: new Date(req.query.start).toISOString() },
      end: { $lte: new Date(req.query.end).toISOString() },
      typeOfService: req.query.tos,
    }).lean();
    console.log(staffEvents);
    console.log([...events, ...staffEvents]);
    res.status(200).json([...events, ...staffEvents]);
  } catch (err) {
    console.log(err);
  }
});

/**
 * @date UTC ISO String of a date for which to search free time.
 * @returns Array of free times as strings.
 */
router.get('/get-free-time', async (req, res) => {
  const { start, end } = getStartEnd(req.query.date);
  const typeOfService = req.query.tos;

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

  const date = new Date(req.query.date);
  const freeTime = calculateFreeTime(date, [...events, ...staffEvents]);

  res.json(freeTime);
});

function getStartEnd(date) {
  return {
    start: new Date(date).toISOString(),
    end: addDays(new Date(date), 1).toISOString(),
  };
}

function calculateFreeTime(date, events) {
  const freeTime = [];
  for (let minutes = 0; minutes < WORK_TIME_DURATION_HOURS * 60; minutes += APPOINTMENT_GRANULARITY_MINUTES) {
    date.setHours(WORK_TIME_BEGIN);
    date.setMinutes(minutes);

    const eventExists = (e) => Date.parse(e.start) <= date.getTime() && Date.parse(e.end) > date.getTime();
    if (events.some((eventExists))) continue;

    freeTime.push(date.toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
  }
  console.log(freeTime);
  return freeTime;
}

module.exports = router;
