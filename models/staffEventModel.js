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
  display: String,

  // Custom properties
  typeOfService: {
    type: String,
  },
  staffId: {
    type: String,
  },
  staffNotes: String,
  eventType: String,
});

const EventModel = mongoose.model('StaffEvent', EventSchema);
module.exports = EventModel;
