/**
 * The response
 */
class ResponseBase {
  #response = null;

  constructor(response) {
    this.#response = response;
  }

  /**
   * Gets a not found response with data
   * @param {any} data Error data
   * @returns Response
   */
  notFound(data) {
    return this.#response
      .status(404)
      .json({ data: data ?? "Not found", status: 404, date: new Date() });
  }

  /**
   * Gets a successful response with data
   * @param {any} data Error data
   * @returns Response
   */
  success(data) {
    return this.#response
      .status(200)
      .json({ status: 200, data: data, date: new Date() });
  }

  /**
   * Gets an empty successful response
   * @param {any} data Error data
   * @returns Response
   */
  successEmpty() {
    return this.#response.status(200).json({ status: 200, date: new Date() });
  }

  /**
   * Gets an error response
   * @param {any} data Error data
   * @returns Response
   */
  error(data) {
    return this.#response
      .status(500)
      .json({
        status: 500,
        data: data ?? "Internal server error",
        date: new Date(),
      });
  }

  /**
   * Gets an error response
   * @param {any} data Error data
   * @returns Response
   */
  notAllowed(data) {
    return this.#response
      .status(401)
      .json({
        status: 401,
        data: data ?? "Not allowed",
        status: 401,
        date: new Date(),
      });
  }
}

export default ResponseBase;
