const mongoose = require('mongoose');

const EventSchema = mongoose.Schema({
  // FullCalendar properties
  start: Date,
  end: Date,
  title: String,
  allDay: {
    type: Boolean,
    default: false,
  },
  display: String, // background

  // extendedProps
  customerId: {
    type: String,
    default: null,
  },
  lastname: {
    type: String,
  },
  email: {
    type: String,
  },
  duration: {
    type: Number,
  },
  typeOfService: {
    type: String,
    enum: ['cosmetics', 'hair', 'massage'],
    required: true,
  },
});

const EventModel = mongoose.model('Event', EventSchema);
module.exports = EventModel;
