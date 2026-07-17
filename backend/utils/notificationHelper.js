let notificationClients = [];

function notifyUser(userId, eventType, data) {
  notificationClients.forEach(c => {
    if (String(c.userId) === String(userId)) {
      try {
        c.res.write(`event: ${eventType}\n`);
        c.res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        console.error(`Failed to push SSE notification to user ${userId}:`, err);
      }
    }
  });
}

function streamNotifications(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required for notification stream.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  });

  const newClient = { userId, res };
  notificationClients.push(newClient);

  req.on('close', () => {
    notificationClients = notificationClients.filter(c => c !== newClient);
  });
}

module.exports = {
  notifyUser,
  streamNotifications
};
