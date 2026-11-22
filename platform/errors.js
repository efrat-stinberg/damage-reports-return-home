// Error carrying an HTTP status so the transport layer can map it without knowing business rules.
class ServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = { ServiceError };
