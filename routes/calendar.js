const router = require('express').Router();

const moment = require('moment');
const jwtDecode = require('jwt-decode');
const EventModel = require('../models/event');
const UserModel = require('../models/user');

router.post('/create-event', async (req, res) => {
  let eventFormValues = req.body;
  if (eventFormValues.token) {
    const decodedToken = jwtDecode(req.body.token);
    const user = await UserModel.findOne({ _id: decodedToken._id })
      .exec()
      .then((result) => result.toObject())
      .catch((err) => console.error('calendar/create-event get user error', err));

    eventFormValues = {
      ...eventFormValues,
      customerId: user._id,
      customerLastName: user.lastname,
    };
  }
  const event = EventModel(eventFormValues);
  await event.save();
  res.sendStatus(201);
});

router.get('/get-events', async (req, res) => {
  const events = await EventModel.find({
    start: { $gte: moment(req.query.start).toDate() },
    end: { $lte: moment(req.query.end).toDate() },
  });
  res.send(events);
  console.log(events);
});

module.exports = router;
