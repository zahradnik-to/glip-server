const router = require('express').Router();

const { addMinutes, addDays } = require('date-fns');
const EventModel = require('../models/eventModel');

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

  console.log('Save this event: ', event);
  await EventModel(event).save();
  // await eventModel.save();
  res.status(201).json(event);
});

router.get('/get-events', async (req, res) => {
  try {
    const events = await EventModel.find({
      start: { $gte: new Date(req.query.start).toISOString() },
      end: { $lte: new Date(req.query.end).toISOString() },
      typeOfService: req.query.tos,
    }).lean();
    console.log('Events: ', events);
    res.status(200).json(events);
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

  const date = new Date(req.query.date);
  const freeTime = calculateFreeTime(date, events);

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
  return freeTime;
}

module.exports = router;
