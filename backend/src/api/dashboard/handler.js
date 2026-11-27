/**
 * Handler endpoint ringkasan dashboard pemilik (khusus role owner).
 * Versi Express.
 */
class DashboardHandler {
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getDashboardSummaryHandler = this.getDashboardSummaryHandler.bind(this);
  }

  /**
   * GET /dashboard/summary
   */
  async getDashboardSummaryHandler(req, res, next) {
    try {
      const { date } = this._validator.validateDashboardQuery(req.query);
      const data = await this._service.getDashboardSummary({ date });

      return res.status(200).json({
        status: 'success',
        data,
      });
    } catch (err) {
      return next(err);
    }
  }
}

export default DashboardHandler;
