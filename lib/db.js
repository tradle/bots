
exports.new = function (path) {
  const db = lowdb(path)
  db.defaults({
      users: {}
    })
    .value()

  return db
}
