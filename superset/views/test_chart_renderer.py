from superset import appbuilder
from superset.views.base import BaseSupersetView
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access


class TestChartRenderPageView(BaseSupersetView):
    route_base = "/test-chart-render"  # don’t use "/"
    # class_permission_name = "TestChartRenderPageView"

    @expose("/")
    @has_access
    def list(self):
        # This will load React App template (frontend)
        return self.render_app_template()


# Register without menu (no sidebar item unless you add it manually)
appbuilder.add_view_no_menu(TestChartRenderPageView)
