const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

// Use service account credentials to authenticate with Firebase Admin
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Firebase HTTP Function for sending a notification
exports.sendNotification = onRequest(async (request, response) => {
  logger.info('Request received:', request.body);

  // Validate that the request method is POST
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  // Extract notification data from the request body
  const { notification, data, token } = request.body;

  console.log('notification', notification);
  console.log('data', data);
  console.log('token', token);

  // Validate that all required fields are provided
  if (!notification || !data || !token) {
    response.status(400).json({ error: 'Missing title, body, or token in request payload' });
    return;
  }

  // FCM message payload
  const message = {
    notification: notification,
    data: data,
    token: token,
  };

  try {
    // Send the notification to the device
    const res = await admin.messaging().send(message);
    logger.info('Notification sent successfully:', res);
    response.status(200).json({ message: 'Notification sent successfully', res });
  } catch (error) {
    logger.error('Error sending notification:', error);
    response.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});
