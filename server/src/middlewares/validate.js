// validate(zodSchema, 'body' | 'query' | 'params') -> replaces req[source] with parsed data.
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = validate;
