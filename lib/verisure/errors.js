class GraphqlError extends Error {
  constructor(errors) {
    super();
    this.name = 'GraphqlException';
    this.message = `GraphQL response contains ${errors.length} errors`;
    this.errors = errors;
  }
}

module.exports = {
  GraphqlError,
};
