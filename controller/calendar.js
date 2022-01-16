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
  event.title = `${event.lastname}`;
  event.end = new Date(addMinutes(new Date(event.start), event.duration)).toISOString();
  const { dateStart, dateEnd } = getDateStartEnd(req.body.date);

  try {
    await EventModel(event).save();
    // If there is no more free time, create all day BC event.
    const events = await getAllEvents(dateStart, dateEnd, req.body.typeOfService);
    const freeTime = calculateFreeTime(new Date(dateStart), events, true);
    if (!freeTime.length) {
      console.log('Creating BC EVENT.');
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
    console.log(allEvents);
    res.status(200).json(allEvents);
  } catch (err) {
    console.error(err);
  }
});

router.get('/get-event', async (req, res) => {
  const { _id } = req.query;
  try {
    EventModel.findById(_id, (err, docs) => {
      if (err) {
        console.log(err);
        res.status(500).json(err);
      } else {
        res.status(200).json(docs);
      }
    }).lean();
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
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
  return {
    dateStart: new Date(date).toISOString(),
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

    const eventExists = (e) => Date.parse(e.start) <= date.getTime() && Date.parse(e.end) > date.getTime();
    if (events.some((eventExists))) continue;

    freeTime.push(date.toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
    if (fullyBookedCheck) return freeTime;
  }
  return freeTime;
}

module.exports = router;
