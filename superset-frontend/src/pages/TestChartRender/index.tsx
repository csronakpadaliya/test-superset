import React, { useState, useEffect } from 'react';
import {
  EchartsPieChartPlugin,
  PieTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import renderFilterFieldTreeNodes from 'src/dashboard/components/filterscope/renderFilterFieldTreeNodes';

let isInitialized = false;

function registerVizPlugins() {
  if (isInitialized) return;

  try {
    new EchartsPieChartPlugin().configure({ key: 'echarts-pie', props: {
          echartOptions: {
            renderer: 'canvas'
          }
        } }).register();

    getChartTransformPropsRegistry().registerValue(
      'echarts-pie',
      PieTransformProps,
    );

    PieTransformProps
    console.log('Superset UI plugins registered successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Error registering Superset UI plugins:', error);
  }
}

const formData = {
  compare_lag: '10',
  compare_suffix: 'o10Y',
  granularity_sqla: 'ds',
  groupby: ['gender'],
  limit: '25',
  markup_type: 'markdown',
  metric: 'sum__num',
  row_limit: 50000,
  time_range: '100 years ago : now',
  viz_type: 'pie',
};

// const queriesData = [
//   {
//     data: {
//       colnames: ['gender', 'sum__num'],
//       coltypes: [1, 0],
//       rowcount: 2,
//       data: [
//         {
//           gender: 'boy',
//           sum__num: 48133355,
//         },
//         {
//           gender: 'girl',
//           sum__num: 32546308,
//         },
//       ],
//     },
//   },
// ];

const queriesData = [
  {
    data: [
      {
        gender: 'boy',
        sum__num: 48133355,
      },
      {
        gender: 'girl',
        sum__num: 32546308,
      },
    ],
  },
];

const defaultTheme: SupersetTheme = {
  colors: {
    grayscale: {
      base: '#444',
      dark2: '#222',
    },
  },
  typography: {
    families: {
      sansSerif: 'Arial, sans-serif',
    },
    sizes: {
      s: 12,
      m: 14,
      l: 16,
    },
  },
};

function TestChartRender() {
  // ✅ Move the useState hook INSIDE the component
  const [pluginsReady, setPluginsReady] = useState(false);

  useEffect(() => {
    try {
      console.log('Registering visualization plugins...');
      registerVizPlugins();
      console.log('Plugins registered successfully');
      setPluginsReady(true);
    } catch (error) {
      console.error('Error registering plugins:', error);
    }
  }, []); // ✅ Add dependency array to prevent infinite re-renders

  if (!pluginsReady) {
    return <div>Loading plugins...</div>;
  }

  return (
    <div className="App">
      <h1>Chart</h1>
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          display: 'inline-block',
        }}
      >
        <SuperChart
          chartType="echarts-pie"
          width={600}
          height={400}
          postTransformProps={(chartProps) => ({
            ...chartProps,
            echartOptions: {
              ...chartProps.echartOptions,
              renderer: 'svg', // or 'canvas'
            },
          })}
          formData={{
            compare_lag: '10',
            compare_suffix: 'o10Y',
            granularity_sqla: 'ds',
            groupby: ['gender'],
            limit: '25',
            markup_type: 'markdown',
            metric: 'sum__num',
            row_limit: 50000,
            time_range: '100 years ago : now',
            viz_type: 'pie',
          }}
          queriesData={[
            {
              data: [
                {
                  gender: 'boy',
                  sum__num: 48133355,
                },
                {
                  gender: 'girl',
                  sum__num: 32546308,
                },
              ],
            },
          ]}
        />
        {/* <SuperChart
          chartType="echarts-pie"
          width={600}
          height={400}
          formData={formData}
          queriesData={queriesData}
        /> */}
        {/* <SuperChart width="600" height="400" chartType="echarts-pie" formData="{&quot;compare_lag&quot;:&quot;10&quot;,&quot;compare_suffix&quot;:&quot;o10Y&quot;,&quot;granularity_sqla&quot;:&quot;ds&quot;,&quot;groupby&quot;:[&quot;gender&quot;],&quot;limit&quot;:&quot;25&quot;,&quot;markup_type&quot;:&quot;markdown&quot;,&quot;metric&quot;:&quot;sum__num&quot;,&quot;row_limit&quot;: 50000,&quot;time_range&quot;:&quot;100 years ago : now&quot;,&quot;viz_type&quot;:&quot;pie&quot;}" queriesData="[{&quot;data&quot;:[{&quot;gender&quot;:&quot;boy&quot;,&quot;sum__num&quot;:48133355},{&quot;gender&quot;:&quot;girl&quot;,&quot;sum__num&quot;:32546308}]}]" theme={defaultTheme}/> */}
      </div>
    </div>
  );
}

export default TestChartRender;

/////////////////////////////////////////////////
