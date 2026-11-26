/**
 * Handler endpoint ringkasan dashboard pemilik (khusus role owner).
 */
class DashboardHandler {
  /**
   * @param {{
   *   service: import('../../services/DashboardService.js').default,
   *   validator: import('../../validator/recap/index.js').default,
   * }} deps
   */
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getDashboardSummaryHandler = this.getDashboardSummaryHandler.bind(this);
  }

  /**
   * GET /dashboard/summary
   */
  async getDashboardSummaryHandler(request, h) {
    const { date } = this._validator.validateDashboardQuery(request.query);
    const data = await this._service.getDashboardSummary({ date });

    return h
      .response({
        status: 'success',
        data,
      })
      .code(200);
  }
}

export default DashboardHandler;
