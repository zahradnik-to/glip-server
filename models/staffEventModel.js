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
    enum: ['cosmetics', 'hair', 'massage'],
  },
  staffId: {
    type: String,
    required: true,
  },
  staffNotes: String,
  eventType: String,
});

const EventModel = mongoose.model('StaffEvent', EventSchema);
module.exports = EventModel;
