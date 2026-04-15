const fs = require("fs");
let s = fs.readFileSync("server/src/routes/admin/users.js", "utf8");
s = s.replace(
  `    const result = await usersColl.findOneAndUpdate(
      { id: id },
      { $set: setObj },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'User not found' });
    const r = result;
    res.json({
      id: r.id,
      email: r.email,
      name: r.name,
      isAdmin: r.is_admin === true,
      isBusinessOwner: r.is_business_owner === true,
      isBlocked: r.is_blocked === true,
    });`,
  `    const u = await usersColl.updateOne({ id: id }, { $set: setObj });
    if (u.matchedCount === 0) return res.status(404).json({ error: 'User not found' });
    const r = await usersColl.findOne({ id: id });
    res.json({
      id: r.id,
      email: r.email,
      name: r.name,
      isAdmin: r.is_admin === true,
      isBusinessOwner: r.is_business_owner === true,
      isBlocked: r.is_blocked === true,
      feedUploadBlocked: r.feed_upload_blocked === true,
    });`
);
fs.writeFileSync("server/src/routes/admin/users.js", s);
console.log("admin users patch response ok");
