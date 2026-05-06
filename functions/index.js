const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Task A: Ghost Erase - Run every Sunday at 3:00 AM
exports.ghostErase = onSchedule("0 3 * * 0", async (event) => {
  console.log("Starting Ghost Erase task...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffTimestamp = sevenDaysAgo.toISOString();

  // reminders are in users/{userId}/reminders subcollections
  const remindersQuery = db.collectionGroup("reminders")
    .where("status", "==", "completed")
    .where("createdAt", "<", cutoffTimestamp);

  const snapshot = await remindersQuery.get();

  if (snapshot.empty) {
    console.log("Ghost Erase: No records to delete.");
    return null;
  }

  const batch = db.batch();
  let deletedCount = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    deletedCount++;
  });

  await batch.commit();
  console.log(`Ghost Erase: Successfully dropped ${deletedCount} records.`);
  return null;
});

// Task B: Stat Aggregation - Run every Sunday at 3:00 AM
exports.statAggregation = onSchedule("0 3 * * 0", async (event) => {
  console.log("Starting Stat Aggregation task...");
  
  try {
    // Count exact registered users via Firebase Auth Admin SDK
    let activeUsers = 0;
    let pageToken;
    do {
      const listUsersResult = await admin.auth().listUsers(1000, pageToken);
      activeUsers += listUsersResult.users.length;
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    const linksSnapshot = await db.collectionGroup("saved_links").get();
    const totalLinks = linksSnapshot.size;

    // Database quota is an approximation or could be pulled from metrics API if needed.
    // For this boilerplate, we'll store a mock value or a basic calculation.
    const databaseQuota = "1.5GB"; 

    await db.doc("platform_stats/daily_metrics").set({
      activeUsers,
      totalLinks,
      databaseQuota,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`Stat Aggregation complete. Active Users: ${activeUsers}, Total Links: ${totalLinks}`);
  } catch (error) {
    console.error("Aggregation failed:", error);
  }
  
  return null;
});
