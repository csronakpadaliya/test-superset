import {
  SuperChart,
  SupersetClient,
  supersetTheme,
  ThemeProvider,
} from '@superset-ui/core';
import React from 'react';

// Wrapper component to handle async data fetching
const SuperChartWrapper = ({ chartId, height }) => {
  const [chartData, setChartData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchChartData = async () => {
      try {
        setLoading(true);

        // Fetch chart metadata
        const chartResponse = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartId}`,
        });

        if (!isMounted) return;

        const vizType = chartResponse.json?.result?.viz_type;
        const formData = JSON.parse(chartResponse.json?.result?.params || '{}');

        // Determine chart type
        let chartType = '';
        if (vizType === 'pie') {
          chartType = 'echarts-pie';
        } else if (vizType === 'echarts_timeseries_line') {
          chartType = 'echarts-timeseries-line';
        }
        // Add more chart type mappings as needed

        // Fetch chart data
        const dataResponse = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartId}/data`,
        });

        if (!isMounted) return;

        const queriesData = dataResponse.json?.result || [];

        setChartData({
          chartType,
          formData,
          queriesData,
        });
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching chart data:', err);
        setError(err.message || 'Failed to load chart');
        setLoading(false);
      }
    };

    fetchChartData();

    return () => {
      isMounted = false;
    };
  }, [chartId]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${height}px`,
          border: '1px solid #ccc',
        }}
      >
        <div>Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${height}px`,
          border: '1px solid #f00',
          color: '#f00',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>
          <div>Error loading chart</div>
          <div style={{ fontSize: '12px', marginTop: '10px' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!chartData || !chartData.chartType) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${height}px`,
          border: '1px solid #ccc',
        }}
      >
        <div>Unsupported chart type</div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #ccc' }}>
      <ThemeProvider theme={supersetTheme}>
        <SuperChart
          chartType={chartData.chartType}
          height={height}
          formData={chartData.formData}
          queriesData={chartData.queriesData}
          postTransformProps={chartProps => ({
            ...chartProps,
            echartOptions: {
              ...chartProps.echartOptions,
              renderer: 'svg',
            },
          })}
        />
      </ThemeProvider>
    </div>
  );
};

export default SuperChartWrapper;
