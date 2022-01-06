const mongoose = require('mongoose');

const ProcedureSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  typeOfService: {
    type: String,
    enum: ['cosmetics', 'hair', 'massage'],
    required: true,
  },
});

const ProcedureModel = mongoose.model('Procedure', ProcedureSchema);
module.exports = ProcedureModel;
