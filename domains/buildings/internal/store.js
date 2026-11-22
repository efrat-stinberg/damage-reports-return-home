// The ONLY place that holds buildings (in-memory). Other domains never see this Map - they use the Buildings API.
const buildings = new Map();

module.exports = {
  get: (id) => buildings.get(id),
  has: (id) => buildings.has(id),
  set: (id, building) => buildings.set(id, building),
  list: () => [...buildings.values()],
};
