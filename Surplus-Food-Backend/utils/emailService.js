const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. Sent to NGO when a Restaurant publishes food
const sendNewFoodAlertToNGO = async ({ ngoEmail, ngoName, restaurantName, foodItem, quantity, address }) => {
  const recipientEmail = ngoEmail || process.env.EMAIL_USER;

  const mailOptions = {
    from: `"Surplus Food Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `🚨 New Food Available: ${foodItem} from ${restaurantName}`,
    html: `
      <h2>New Food Surplus Published!</h2>
      <p>Hello <strong>${ngoName || 'NGO Partner'}</strong>,</p>
      <p>A new food donation post has just been published on the platform:</p>
      <ul>
        <li><strong>Donor/Restaurant:</strong> ${restaurantName}</li>
        <li><strong>Food Item:</strong> ${foodItem}</li>
        <li><strong>Quantity:</strong> ${quantity}</li>
        <li><strong>Address:</strong> ${address || 'Check portal map'}</li>
      </ul>
      <p>Log into your dashboard to claim this item before it expires.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Publish email sent to NGO:', recipientEmail);
    return info;
  } catch (error) {
    console.error('Error sending publish email to NGO:', error);
  }
};

// 2. Sent to Restaurant when an NGO claims the food
const sendClaimNotificationToDonor = async ({ donorEmail, donorName, ngoName, ngoEmail, foodItem, quantity }) => {
  const recipientEmail = donorEmail || process.env.EMAIL_USER;

  const mailOptions = {
    from: `"Surplus Food Portal" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `✅ Food Post Claimed: ${foodItem} by ${ngoName}`,
    html: `
      <h2>Your Surplus Food Post Has Been Claimed!</h2>
      <p>Dear <strong>${donorName || 'Donor'}</strong>,</p>
      <p>Great news! An NGO has claimed your posted food item on Surplus Food Portal.</p>
      <ul>
        <li><strong>Claimed By (NGO):</strong> ${ngoName}</li>
        <li><strong>NGO Contact Email:</strong> ${ngoEmail || 'Provided on portal'}</li>
        <li><strong>Food Item:</strong> ${foodItem}</li>
        <li><strong>Quantity:</strong> ${quantity}</li>
      </ul>
      <p>Please keep the food ready for pickup.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Claim notification sent to Restaurant:', recipientEmail);
    return info;
  } catch (error) {
    console.error('Error sending claim email to Restaurant:', error);
  }
};

module.exports = {
  sendNewFoodAlertToNGO,
  sendClaimNotificationToDonor
};