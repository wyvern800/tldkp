const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
admin.initializeApp();

const MAX_READS_PER_HOUR = 100; // Set a threshold for suspicious reads

exports.logUserReads = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const userId = req.auth ? req.auth.uid : 'unauthenticated';
  const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Log the read request details
  const logEntry = {
    userId,
    userIp,
    requestUrl: req.url,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    // Save the log entry to a logging collection
    await admin.firestore().collection('userReadLogs').add(logEntry);

    // Check the number of requests in the last hour
    const oneHourAgo = admin.firestore.Timestamp.now().toMillis() - 60 * 60 * 1000;
    const requestCountSnapshot = await admin.firestore()
      .collection('userReadLogs')
      .where('userIp', '==', userIp)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromMillis(oneHourAgo))
      .get();

    const requestCount = requestCountSnapshot.size;

    // If the count exceeds the threshold, take action
    if (requestCount > MAX_READS_PER_HOUR) {
      console.warn(`Suspicious activity detected from ${userIp} (${userId}): ${requestCount} reads in the last hour.`);
      // Implement logic to notify admins or block the user
    }

    // Retrieve the 'guilds' collection
    const guildsSnapshot = await admin.firestore().collection('guilds').get();
    const guilds = guildsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Return the users data
    res.status(200).json(guilds);
  } catch (error) {
    console.error('Error reading guilds collection:', error);
    res.status(500).send('Error retrieving guilds');
  }
});
