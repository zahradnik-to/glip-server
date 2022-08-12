const nodemailer = require('nodemailer');
const { glipMailHelper } = require('./helper/glipMailerHelper');

class GlipMailer {
  constructor() {
    this.glipEmail = process.env.GLIP_EMAIL;
    this.transport = nodemailer.createTransport({
      port: glipMailHelper.MAILHOG_PORT,
    });
  }

  sendEmail(to, subject, text) {
    this.transport.sendMail({
      from: this.glipEmail,
      to,
      subject,
      text,
    });
  }
}

module.exports = new GlipMailer();
