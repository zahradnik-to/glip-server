/* eslint-disable no-console */
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
require('./controller/passport');

const passport = require('passport');
const cookieSession = require('cookie-session');
const indexRouter = require('./controller/index');
const usersRouter = require('./controller/user');
const calendarRouter = require('./controller/calendar');
const procedureRoute = require('./controller/procedure');
const authRoute = require('./controller/auth');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
  name: 'session',
  keys: ['glip'],
  maxAge: 24 * 60 * 60 * 100, // 1 day
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/user', usersRouter);
app.use('/calendar', calendarRouter);
app.use('/procedure', procedureRoute);
app.use('/auth', authRoute);

mongoose.connect(process.env.MONGO_DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}, () => console.log('Database ready!'));

app.listen(process.env.APP_PORT, () => {
  console.log(`Express listening on http://localhost:${process.env.APP_PORT}`);
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
