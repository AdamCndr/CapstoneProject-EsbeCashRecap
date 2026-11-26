/**
 * Handler endpoint rekapitulasi transaksi (khusus role owner).
 */
class RecapHandler {
  /**
   * @param {{
   *   service: import('../../services/RecapService.js').default,
   *   validator: import('../../validator/recap/index.js').default,
   * }} deps
   */
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getRecapHandler = this.getRecapHandler.bind(this);
  }

  /**
   * GET /recap?date_from&date_to&group_by=date,shift,method
   */
  async getRecapHandler(request, h) {
    const { dateFrom, dateTo, groupBy } = this._validator.validateRecapQuery(request.query);
    const data = await this._service.getRecap({ dateFrom, dateTo, groupBy });

    return h
      .response({
        status: 'success',
        data,
      })
      .code(200);
  }
}

export default RecapHandler;
