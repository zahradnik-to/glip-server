const router = require('express').Router();

const moment = require('moment');
const jwt = require('jsonwebtoken');
const EventModel = require('../models/event');
const UserModel = require('../models/user');

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

  const eventModel = EventModel(event);
  await eventModel.save();
  res.json(event).status(201);
});

router.get('/get-events', async (req, res) => {
  const events = await EventModel.find({
    start: { $gte: moment(req.query.start).toDate() },
    end: { $lte: moment(req.query.end).toDate() },
  });
  res.send(events);
});

router.get('/get-free-time', async (req, res) => {
  // Todo algo for hiding occupied times
  // const events = await EventModel.find({
  //   start: { $gte: moment(req.query.start).toDate() },
  //   end: { $lte: moment(req.query.end).toDate() },
  // });

  const freeTime = [];
  const date = new Date();

  for (let minutes = 0; minutes < 8 * 60; minutes += 30) {
    date.setHours(8);
    date.setMinutes(minutes);
    freeTime.push(date.toLocaleTimeString('cs', {
      hour: '2-digit',
      minute: 'numeric',
    }));
  }

  res.send(freeTime);
});
module.exports = router;
