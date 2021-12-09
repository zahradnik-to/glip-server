const router = require('express').Router();

const moment = require('moment');
const jwt = require('jsonwebtoken');
const EventModel = require('../models/eventModel');
const UserModel = require('../models/userModel');

/**
 * Takes values from client form, fills missing parameters, saves to Mongo.
 * @return object On resolve returns an object of saved document
 */
router.post('/create-event', async (req, res) => {
  let event = req.body;
  if (req.headers.authorization) {
    const decrypt = jwt.verify(req.headers.authorization, process.env.SECRET);
    const user = await UserModel.findOne({ _id: decrypt._id }).exec()
      .then((result) => result.toObject())
      .catch((err) => console.error('calendar/create-event get user error', err));
    if (event.allDay && user.role !== 'admin') event.allDay = false;

    event = {
      ...event,
      customerId: user._id,
    };
  }

  event = {
    ...event,
    title: `${event.lastname} ${event.duration}min`,
    end: moment(event.start).add(event.duration, 'minutes'),
  };

  await EventModel(event).save();
  // await eventModel.save();
  res.status(201).json(event);
});

router.get('/get-events', async (req, res) => {
  // Fixme add TOS to filters
  try {
    const events = await EventModel.find({
      start: { $gte: moment(req.query.start).toDate() },
      end: { $lte: moment(req.query.end).toDate() },
    });
    res.status(200).json(events);
  } catch (err) {
    console.log(err);
  }
});

router.get('/get-free-time', async (req, res) => {
  // Todo algo for hiding occupied times
  let start;
  let end;
  if (req.query.date) {
    start = req.query.date;
    end = moment(req.query.date).add(1, 'day').toDate().toISOString();
    console.log(end);
  } else {
    start = moment(req.query.start).toDate();
    end = moment(req.query.end).add(1, 'day').toDate();
  }

  const events = await EventModel.find({
    start: { $gte: start },
    end: { $lte: end },
    typeOfService: req.query.typeOfService,
  }).lean();

  const freeTime = [];
  const date = new Date(req.query.start);

  for (let minutes = 0; minutes < 8 * 60; minutes += 30) {
    date.setHours(8); // Work time begin
    date.setMinutes(minutes);

    const exists = (e) => Date.parse(e.start) <= date.getTime() && Date.parse(e.end) > date.getTime();
    // eslint-disable-next-line no-continue
    if (events.some((exists))) {
      console.log(date.toISOString());
      // Fixme
      // eslint-disable-next-line no-continue
      continue;
    }

    freeTime.push(date.toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
  }

  console.log(freeTime);

  res.json(freeTime);
});
module.exports = router;
