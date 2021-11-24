const mongoose = require('mongoose');

const EventSchema = mongoose.Schema({
  start: Date,
  end: Date,
  customerId: String,
  customerLastName: String,
  duration: {
    type: String,
    enum: ['15', '60', '90'],
  },
  typeOfService: {
    type: String,
    enum: ['cosmetics', 'hair', 'massage'],
  },
});

const EventModel = mongoose.model('Event', EventSchema);
module.exports = EventModel;
