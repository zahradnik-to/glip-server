const nodemailer = require('nodemailer');

const MAILHOG_PORT = 1025;

class GlipMailer {
  constructor() {
    this.glipEmail = process.env.GLIP_EMAIL;
    this.transport = nodemailer.createTransport({
      port: MAILHOG_PORT,
    });
  }

  async sendEmail(to, subject, text) {
    await this.transport.sendMail({
      from: this.glipEmail,
      to,
      subject,
      text,
    });
  }
}

module.exports = new GlipMailer();
