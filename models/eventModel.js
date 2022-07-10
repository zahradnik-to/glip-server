const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const EventSchema = mongoose.Schema({
  // FullCalendar properties
  start: Date,
  end: Date,
  title: String,
  display: String, // background

  // extendedProps
  lastname: String,
  email: String,
  duration: Number,
  phoneNumber: String,
  procedureId: String,
  notes: String,
  staffNotes: String,
  customerId: {
    type: String,
    default: null,
  },
  typeOfService: {
    type: String,
    required: true,
  },
  canceled: {
    type: Boolean,
    default: false,
  },
});

EventSchema.plugin(mongoosePaginate);

const EventModel = mongoose.model('Event', EventSchema);
module.exports = EventModel;
