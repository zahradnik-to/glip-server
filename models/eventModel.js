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
  lastname: String,
  email: String,
  duration: Number,
  procedureId: String,
  notes: String,
  staffNotes: String,
  customerId: {
    type: String,
    default: null,
  },
  typeOfService: {
    type: String,
    enum: ['cosmetics', 'hair', 'massage'],
    required: true,
  },
  canceled: {
    type: Boolean,
    default: false,
  },
});

const EventModel = mongoose.model('Event', EventSchema);
module.exports = EventModel;
