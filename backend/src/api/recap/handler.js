/**
 * Handler endpoint rekapitulasi transaksi (khusus role owner).
 * Versi Express.
 */
class RecapHandler {
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getRecapHandler = this.getRecapHandler.bind(this);
  }

  /**
   * GET /recap?date_from&date_to&group_by=date,shift,method
   */
  async getRecapHandler(req, res, next) {
    try {
      const { dateFrom, dateTo, groupBy } = this._validator.validateRecapQuery(req.query);
      const data = await this._service.getRecap({ dateFrom, dateTo, groupBy });

      return res.status(200).json({
        status: 'success',
        data,
      });
    } catch (err) {
      return next(err);
    }
  }
}

export default RecapHandler;
