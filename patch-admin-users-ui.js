const fs = require("fs");
let s = fs.readFileSync("client/src/pages/admin/AdminUsers.jsx", "utf8");
if (!s.includes("feedUploadBlocked")) {
  s = s.replace(
    "<th>Blocked</th>\n                    <th>Email",
    "<th>Blocked</th>\n                    <th>No feed upload</th>\n                    <th>Email"
  );
  s = s.replace(
    `      const body =
        field === 'isAdmin'
          ? { isAdmin: !u.isAdmin }
          : field === 'isBusinessOwner'
            ? { isBusinessOwner: !u.isBusinessOwner }
            : { isBlocked: !u.isBlocked };`,
    `      const body =
        field === 'isAdmin'
          ? { isAdmin: !u.isAdmin }
          : field === 'isBusinessOwner'
            ? { isBusinessOwner: !u.isBusinessOwner }
            : field === 'feedUploadBlocked'
              ? { feedUploadBlocked: !u.feedUploadBlocked }
              : { isBlocked: !u.isBlocked };`
  );
  s = s.replace(
    `                        <td>
                          <label
                            style={{ cursor: savingId === u.id || isSelf ? 'not-allowed' : 'pointer' }}
                            title={isSelf ? 'Cannot block your own account' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.isBlocked}
                              disabled={savingId === u.id || isSelf}
                              onChange={() => toggle(u, 'isBlocked')}
                            />
                          </label>
                        </td>
                        <td>{u.emailVerified ? 'Yes' : 'No'}</td>`,
    `                        <td>
                          <label
                            style={{ cursor: savingId === u.id || isSelf ? 'not-allowed' : 'pointer' }}
                            title={isSelf ? 'Cannot block your own account' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.isBlocked}
                              disabled={savingId === u.id || isSelf}
                              onChange={() => toggle(u, 'isBlocked')}
                            />
                          </label>
                        </td>
                        <td>
                          <label style={{ cursor: savingId === u.id ? 'not-allowed' : 'pointer' }} title="Block posting to community feed / reels">
                            <input
                              type="checkbox"
                              checked={!!u.feedUploadBlocked}
                              disabled={savingId === u.id}
                              onChange={() => toggle(u, 'feedUploadBlocked')}
                            />
                          </label>
                        </td>
                        <td>{u.emailVerified ? 'Yes' : 'No'}</td>`
  );
  fs.writeFileSync("client/src/pages/admin/AdminUsers.jsx", s);
  console.log("admin users ui ok");
} else console.log("skip");
