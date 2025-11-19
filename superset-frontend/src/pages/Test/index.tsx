import React, { useState, useEffect, useRef, useCallback } from 'react';
import grapesjs, { Editor, Page } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import {
  EchartsPieChartPlugin,
  EchartsTimeseriesLineChartPlugin,
  PieTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import {
  SuperChart,
  SupersetTheme,
  getChartTransformPropsRegistry,
  SupersetThemeProps,
  SupersetClient,
  supersetTheme,
} from '@superset-ui/core';
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import rison from 'rison';
import { id } from 'spec/fixtures/mockDatasource';
import SuperChartWrapper from './SuperChartWrapper';
import './index.css';
import SuperChartWrapperWithStatic from './SupertChartWrapperWithStatic';
import { getNewPage, handleAddPage, handleDeletePage, handleDragLeave, handleDragOver, handleDragStart, handleDrop, handlePageSelect } from '../../utils/grapesjs/page-management';

let isInitialized = false;

function registerVizPlugins() {
  // if (isInitialized) return;

  try {
    new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();

    new EchartsTimeseriesLineChartPlugin()
      .configure({ key: 'echarts-timeseries-line' })
      .register();

    // getChartTransformPropsRegistry().registerValue(
    //   'echarts-pie',
    //   PieTransformProps,
    // );

    console.log('Superset UI plugins registered successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Error registering Superset UI plugins:', error);
  }
}

function Test() {
  const [editor, setEditor] = useState(null);
  const editorRef = useRef(null);
  const [pluginsReady, setPluginsReady] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | number>();
  const [draggedPage, setDraggedPage] = useState<Page>();
  const [draggedPageSourceIndex, setDraggedPageSourceIndex] = useState<number>();
  const [draggedPageTargetIndex, setDraggedPageTargetIndex] = useState<number>();
  const [pageWidth, setPageWidth] = useState(794);
  const [pageHeight, setPageHeight] = useState(1123);
  // ✅ Move the useState hook INSIDE the component

  useEffect(() => {
    document.documentElement.style.setProperty('--gjs-frame-width', `${pageWidth}px`);
  }, [pageWidth]);

  // Below is not required.
  // useEffect(() => {
  //   document.documentElement.style.setProperty('--gjs-frame-height', `${pageHeight}px`);
  // }, [pageHeight]);

  useEffect(() => {
    try {
      console.log('Registering visualization plugins...');
      registerVizPlugins();
      console.log('Plugins registered successfully');
      setPluginsReady(true);
    } catch (error) {
      console.error('Error registering plugins:', error);
    }

    if (!editorRef.current) {
      const editorInstance = grapesjs.init({
        container: '#gjs',
        height: 'calc(100vh - 56px)', // Minus navbar height
        // width: 'auto',
        storageManager: false, // disables local storage (optional)
        pageManager: {
          pages: [
            getNewPage(1, pageHeight)
          ],
        },
        canvasCss: `[data-gjs-type="wrapper"] {
          height: ${pageHeight}px !important
          }
        `,
        richTextEditor: {
          actions: ['bold', 'italic', 'underline', 'strikethrough', 'link']
        },
      });

      HideDevicesMenu(editorInstance);

      AddTextBoxBlock(editorInstance);

      AddImageBlock(editorInstance);

      AddOneColumnBlock(editorInstance);

      AddTwoColumnBlock(editorInstance);

      AddCustomCodeBlock(editorInstance);

      AddSuperChartBlock(editorInstance);

      UpdateOptionsPanel(editorInstance);

      ConfigureRichTextEditor(editorInstance);

      // makeBlocksForCharts(editorInstance);

      AddChartBlock(editorInstance);

      editorInstance.on('load', () => {
        // makeFrameScrollable(editorInstance);

        // Get all pages and set to state
        const allPages = editorInstance.Pages.getAll();
        setPages(allPages);

        // Set the selected page
        const currentPage = editorInstance.Pages.getSelected();
        setSelectedPage(currentPage?.id);

        // makeFrameScrollable(editorInstance);
      });

      editorInstance.on('component:resize:end', model => {
        console.log('Component resized:', model);

        if (model.component.attributes.type === 'super-chart') {
          const el = model.el;
          if (!el) return;

          const newWidth = el.offsetWidth;
          const newHeight = el.offsetHeight;

          console.log(`New dimensions: ${newWidth}x${newHeight}`);

          model.component.attributes.attributes.width = String(newWidth);
          model.component.attributes.attributes.height = String(newHeight);

          if (model.component.renderChart) 
            model.component.renderChart(el);
        }
        else if (model.component.attributes.type === 'resizable-column') // for rendering the chart after resize done of two columns block complete
        {
          const parentComp = model.component.parent();
          if (!parentComp) return;

          const renderNestedCharts = (c: any) => {
            c.components().forEach((child: any) => {
              if (child.get('type') === 'super-chart') {
                const el = child.view?.el;
                if (el && typeof child.renderChart === 'function') {
                  console.log(`Re-rendering chart in ${c.getAttributes()['data-column'] || 'nested'} block`);
                  child.renderChart(el);
                }
              }
              // recursive descent into any inner divs or blocks
              if (child.components().length) 
                renderNestedCharts(child);
            });
          };

          parentComp.components().forEach((col: any) => renderNestedCharts(col));
        }
      });

      editorInstance.Commands.add('export-to-pdf', {
        run: editor => {
          exportToPDF(editor, pageWidth);
          return true;
        },
      });

      editorInstance.on('page', () => {
        const updatedPages = editorInstance.Pages.getAll();
        setPages(updatedPages);
      });

      editorRef.current = editorInstance;
      setEditor(editorInstance);
    }
  }, []);

  return (
    <div className="grapesjs-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>Pages</h2>

        {/* Add Page Button */}
        <button
          className="add-page-btn"
          onClick={() => handleAddPage(editor, setSelectedPage, pageHeight)}
        >
          + Add Page
        </button>

        <ul className="page-list">
          {pages.map((page, index) => (
            <li 
              key={page.id} 
              draggable
              onDragStart={() => handleDragStart(page, index, setDraggedPage, setDraggedPageSourceIndex)}
              onDragOver={(e) => handleDragOver(e, index, setDraggedPageTargetIndex)}
              onDragLeave={() => handleDragLeave(setDraggedPageTargetIndex)}
              onDrop={(e) => handleDrop(editor, e, draggedPageSourceIndex, draggedPageTargetIndex, draggedPage, setDraggedPage, setDraggedPageTargetIndex)}
              className={draggedPageTargetIndex === index ? 'drag-over' : ''}
            >
              <div className="page-item">
                <div className="drag-handle">☰</div>
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    handlePageSelect(editor, page.id, setSelectedPage);
                  }}
                  className={selectedPage === page.id ? 'active' : ''}
                >
                  {page.getName()}
                </a>
                <button
                  className="delete-page-btn"
                  onClick={(e) => handleDeletePage(editor, page.id, index, e, pages, selectedPage, setSelectedPage)}
                  title="Delete page"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>

        {pages.length === 0 && <p>No pages available</p>}
      </div>

      <div id="gjs"></div>
    </div>

    // <div className="App">
    //   <div className="Editor">
    //     {/* <div id="gjs" style={{ height: '100vh', width: '100%' }} /> */}
    //     <div id="gjs" />
    //   </div>
    // </div>
  );
}

function makeBlocksForCharts(editorInstance: Editor) {
  let query = {
    columns: ['id', 'slice_name'],
  };

  SupersetClient.get({
    endpoint: `/api/v1/chart?q=${rison.encode(query)}`,
  }).then(({ json }) => {
    json?.result?.map((chart: any) => {
      editorInstance.BlockManager.add(chart.slice_name, {
        label: chart.slice_name,
        category: 'Charts',
        media: `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"       
                width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.5 2c-.178 0-.356.013-.492.022l-.074.005a1 1 0 0 0-.934.998V11a1 1 0 0 0 1 1h7.975a1 1 0 0 0 .998-.934l.005-.074A7.04 7.04 0 0 0 22 10.5 8.5 8.5 0 0 0 13.5 2Z"/>
                <path d="M11 6.025a1 1 0 0 0-1.065-.998 8.5 8.5 0 1 0 9.038 9.039A1 1 0 0 0 17.975 13H11V6.025Z"/>
              </svg>
              `,
        // attributes: { class: 'fa fa-pie-chart' },
        content: {
          type: 'super-chart',
          attributes: {
            id: chart.id,
            height: '400',
          },
          resizable: true, // Enable resizing
        },
      });
    });
  });
}

// Using old without wait for rendering the chart
// async function exportToPDF(editor: Editor) {
//   // Get the HTML content from GrapesJS
//   const html = editor.getHtml();
//   const css = editor.getCss();

//   // Create a temporary container to render the content
//   const container = document.createElement('div');
//   container.innerHTML = html;
//   container.style.position = 'absolute';
//   container.style.left = '-9999px';
//   container.style.width = '794px'; // A4 width at 96 DPI

//   // Add styles
//   const style = document.createElement('style');
//   style.textContent = css;
//   container.appendChild(style);

//   document.body.appendChild(container);

//   console.log('Conainer before replacing image to SuperCharts: ', container);

//   try {
//     // Find all super-chart elements
//     const chartElements = container.querySelectorAll('super-chart');
//     console.log(`Found ${chartElements.length} chart elements to process`);

//     // Process each chart element
//     for (const chartEl of Array.from(chartElements)) {
//       try {
//         // Get chart attributes
//         const chartId = parseInt(chartEl.getAttribute('chartId') || '12', 10);
//         const height = parseInt(chartEl.getAttribute('height') || '400', 10);
//         const chartType = chartEl.getAttribute('charttype') || '';
//         const formData = JSON.parse(chartEl.getAttribute('formdata') || '{}');
//         const queriesData = JSON.parse(
//           chartEl.getAttribute('queriesdata') || '[]',
//         );

//         // Get the actual width of the chart element in the container
//         const actualWidth =
//           chartEl.getBoundingClientRect().width ||
//           parseInt(getComputedStyle(chartEl).width) ||
//           container.clientWidth;

//         console.log(
//           `Processing chart: type=${chartType}, width=${actualWidth}px, height=${height}px`,
//         );

//         // Create a temporary div to render the chart with fixed dimensions
//         const tempChartContainer = document.createElement('div');
//         tempChartContainer.style.width = `${actualWidth}px`;
//         tempChartContainer.style.height = `${height}px`;
//         tempChartContainer.style.position = 'fixed';
//         tempChartContainer.style.top = '0';
//         tempChartContainer.style.left = '0';
//         tempChartContainer.style.zIndex = '-1000';
//         tempChartContainer.style.backgroundColor = '#ffffff';
//         tempChartContainer.style.overflow = 'hidden';
//         document.body.appendChild(tempChartContainer);

//         // Create a promise to wait for chart rendering
//         const renderPromise = new Promise(resolve => {
//           ReactDOM.unmountComponentAtNode(tempChartContainer);

//           // Render the chart with explicit width and height
//           ReactDOM.render(
//             // <SuperChart
//             //   chartType={chartType}
//             //   width={actualWidth} // Use fixed width in pixels
//             //   height={height}
//             //   formData={formData}
//             //   queriesData={queriesData}
//             //   theme={defaultTheme}
//             //   postTransformProps={chartProps => ({
//             //     ...chartProps,
//             //     echartOptions: {
//             //       ...chartProps.echartOptions,
//             //       renderer: 'svg', // or 'canvas'
//             //     },
//             //   })}
//             // />,
//             <SuperChartWrapper chartId={chartId} height={height} />,
//             tempChartContainer,
//             () => {
//               console.log(`Chart rendered in temp container`);
//               // Give additional time for ECharts to render
//               setTimeout(resolve, 1500);
//             },
//           );
//         });

//         // Wait for chart to render
//         await renderPromise;

//         // Detect if chart is rendered with SVG or Canvas
//         const svgElement = tempChartContainer.querySelector('svg');
//         const canvasElement = tempChartContainer.querySelector('canvas');

//         let replacementElement: HTMLElement;

//         if (svgElement) {
//           console.log('Chart rendered with SVG, using SVG directly...');

//           // Clone the SVG to avoid modifying the original
//           const clonedSvg = svgElement.cloneNode(true) as SVGElement;

//           // Set explicit dimensions on SVG if not present
//           if (!clonedSvg.getAttribute('width')) {
//             clonedSvg.setAttribute('width', `${actualWidth}`);
//           }
//           if (!clonedSvg.getAttribute('height')) {
//             clonedSvg.setAttribute('height', `${height}`);
//           }

//           // Add viewBox if not present for better scaling
//           if (!clonedSvg.getAttribute('viewBox')) {
//             clonedSvg.setAttribute('viewBox', `0 0 ${actualWidth} ${height}`);
//           }

//           // Ensure SVG preserves aspect ratio
//           if (!clonedSvg.getAttribute('preserveAspectRatio')) {
//             clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
//           }

//           clonedSvg.style = '';
//           clonedSvg.style.border = '1px solid #ccc';

//           console.log('SVG = ', clonedSvg);
//           console.log(container);
//           chartEl.parentNode?.replaceChild(clonedSvg, chartEl);

//           // Clean up
//           ReactDOM.unmountComponentAtNode(tempChartContainer);
//           document.body.removeChild(tempChartContainer);
//           console.log(
//             `Replaced chart with high-resolution SVG image: ${actualWidth}x${height}`,
//           );
//         } else if (canvasElement) {
//           // Capture the chart with higher resolution
//           const canvas = await html2canvas(tempChartContainer, {
//             scale: 4, // Increased from 2 to 4 for higher resolution
//             useCORS: true,
//             logging: false,
//             backgroundColor: '#ffffff',
//             allowTaint: true,
//             imageTimeout: 0, // No timeout for image loading
//             pixelRatio: window.devicePixelRatio * 6, // Use higher pixel ratio
//           });

//           // Replace the super-chart element with the image
//           const img = document.createElement('img');
//           img.src = canvas.toDataURL('image/png', 1.0); // Use highest quality
//           img.style.width = `${actualWidth}px`; // Set fixed width to match original
//           img.style.height = `${height}px`;
//           img.style.border = '1px solid #ccc';
//           img.style.boxSizing = 'border-box';
//           img.style.display = 'block'; // Prevent inline display issues
//           chartEl.parentNode?.replaceChild(img, chartEl);

//           // Clean up
//           ReactDOM.unmountComponentAtNode(tempChartContainer);
//           document.body.removeChild(tempChartContainer);
//           console.log(
//             `Replaced chart with high-resolution image: ${actualWidth}x${height}`,
//           );
//         }
//       } catch (err) {
//         console.error(`Error processing chart:`, err);

//         // Create a placeholder for failed chart
//         const placeholder = document.createElement('div');
//         placeholder.style.width = '100%';
//         placeholder.style.height = `${parseInt(
//           chartEl.getAttribute('height') || '400',
//           10,
//         )}px`;
//         placeholder.style.border = '1px solid #ccc';
//         placeholder.style.display = 'flex';
//         placeholder.style.alignItems = 'center';
//         placeholder.style.justifyContent = 'center';
//         placeholder.style.backgroundColor = '#f9f9f9';
//         placeholder.textContent = `Chart could not be rendered`;
//         chartEl.parentNode?.replaceChild(placeholder, chartEl);
//       }
//     }

//     console.log('Conainer after replacing image to SuperCharts: ', container);

//     // Open a clean window, not inheriting src/context from Superset
//     const printWindow = window.open('', '_blank', 'width=800,height=1000');
//     if (!printWindow) {
//       alert('Please allow pop-ups to export PDF');
//       return;
//     }

//     printWindow.document.write(`
//             <!DOCTYPE html>
//             <html>
//               <head>
//                 <title>Print to PDF</title>

//               </head>
//               <body>
//                 ${container.innerHTML}
//               </body>
//             </html>
//           `);

//     printWindow.document.close();

//     // Wait for all resources (especially images and fonts) to load before printing
//     printWindow.onload = function () {
//       setTimeout(() => {
//         printWindow.focus();
//         printWindow.print();
//         // Optionally close the window after some delay
//         // setTimeout(() => { printWindow.close(); }, 1000);
//       }, 1000);
//     };
//   } catch (error) {
//     console.error('Error generating PDF:', error);
//     alert('Error generating PDF. Please check console for details.');
//   } finally {
//     // Clean up
//     document.body.removeChild(container);
//   }
// }

async function exportToPDF(editor: Editor, pageWidth: number) {
  // Create loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'pdf-export-loading-overlay';
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    font-family: Arial, sans-serif;
  `;

  const loadingBox = document.createElement('div');
  loadingBox.style.cssText = `
    background: white;
    padding: 30px 40px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    text-align: center;
    min-width: 300px;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  `;

  const loadingText = document.createElement('div');
  loadingText.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    color: #333;
    margin-bottom: 10px;
  `;
  loadingText.textContent = 'Exporting to PDF...';

  const progressText = document.createElement('div');
  progressText.id = 'pdf-export-progress';
  progressText.style.cssText = `
    font-size: 14px;
    color: #666;
    margin-top: 10px;
  `;
  progressText.textContent = 'Initializing...';

  // Add CSS animation for spinner
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);

  loadingBox.appendChild(spinner);
  loadingBox.appendChild(loadingText);
  loadingBox.appendChild(progressText);
  loadingOverlay.appendChild(loadingBox);
  document.body.appendChild(loadingOverlay);

  // Helper function to update progress
  const updateProgress = (message: string) => {
    const progressElement = document.getElementById('pdf-export-progress');
    if (progressElement) {
      progressElement.textContent = message;
    }
    console.log(message);
  };

  try {
    // Get the HTML content from GrapesJS
    updateProgress('Getting editor content...');

    // Old Way - to get html and css of selected page by grapejs editor.
    // const html = editor.getHtml();
    // const css = editor.getCss();

    // Create a temporary container to render the content
    const allPagesContainer = document.createElement('div');
    allPagesContainer.style.position = 'absolute';
    allPagesContainer.style.left = '-9999px';
    // allPagesContainer.style.width = '794px'; // A4 width at 96 DPI
    allPagesContainer.style.width = `${pageWidth.toString()}px`; // A4 width at 96 DPI

    const wrappers = editor.Pages.getAllWrappers();
    wrappers.map(wrp => {
      // Create a page container
      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page';
      pageContainer.style.cssText = `
      page-break-after: always;
      margin-bottom: 20px;
      position: relative;
    `;
      pageContainer.innerHTML = wrp.toHTML();
      allPagesContainer.appendChild(pageContainer);
    });

    // Get ALL CSS rules at once (this should include all pages)
    const allCssRules = editor.CssComposer.getAll();
    const css = allCssRules.map(rule => rule.toCSS()).join('\n');

    // Add styles
    const style = document.createElement('style');
    style.textContent = css;
    allPagesContainer.appendChild(style);

    document.body.appendChild(allPagesContainer);

    console.log(
      'Container before replacing image to SuperCharts: ',
      allPagesContainer,
    );

    // Find all super-chart elements
    const chartElements = allPagesContainer.querySelectorAll('super-chart');
    updateProgress(`Found ${chartElements.length} chart(s) to process`);
    console.log(`Found ${chartElements.length} chart elements to process`);

    // Process each chart element sequentially with proper waiting
    for (let i = 0; i < chartElements.length; i++) {
      const chartEl = chartElements[i];
      updateProgress(`Processing chart ${i + 1} of ${chartElements.length}...`);
      console.log(`Processing chart ${i + 1}/${chartElements.length}`);

      try {
        // Get chart attributes
        const chartId = parseInt(chartEl.getAttribute('chartId') || '12', 10);
        const height = parseInt(chartEl.getAttribute('height') || '400', 10);
        const chartType = chartEl.getAttribute('charttype') || '';
        const formData = JSON.parse(chartEl.getAttribute('formdata') || '{}');
        const queriesData = JSON.parse(
          chartEl.getAttribute('queriesdata') || '[]',
        );

        // Get the actual width of the chart element in the container
        const actualWidth =
          chartEl.getBoundingClientRect().width ||
          parseInt(getComputedStyle(chartEl).width) ||
          allPagesContainer.clientWidth;

        console.log(
          `Processing chart ${
            i + 1
          }: type=${chartType}, width=${actualWidth}px, height=${height}px, chartId=${chartId}`,
        );

        // Create a temporary div to render the chart with fixed dimensions
        const tempChartContainer = document.createElement('div');
        tempChartContainer.style.width = `${actualWidth}px`;
        tempChartContainer.style.height = `${height}px`;
        tempChartContainer.style.position = 'fixed';
        tempChartContainer.style.top = '0';
        tempChartContainer.style.left = '0';
        tempChartContainer.style.zIndex = '-1000';
        tempChartContainer.style.backgroundColor = '#ffffff';
        tempChartContainer.style.overflow = 'hidden';
        tempChartContainer.id = `temp-chart-${chartId}-${i}`;
        document.body.appendChild(tempChartContainer);

        updateProgress(
          `Rendering chart ${i + 1} of ${chartElements.length}...`,
        );

        // Wait for chart rendering with proper promise handling
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(`Chart ${i + 1} rendering timeout after 30 seconds`),
            );
          }, 30000); // 30 second timeout per chart

          try {
            ReactDOM.unmountComponentAtNode(tempChartContainer);

            // Render the chart
            ReactDOM.render(
              <SuperChartWrapper chartId={chartId} height={height} />,
              tempChartContainer,
              async () => {
                console.log(`Chart ${i + 1} React component mounted`);

                // Wait for the chart to actually render (API calls + rendering)
                // Poll for SVG or Canvas element
                let attempts = 0;
                const maxAttempts = 60; // 30 seconds (500ms * 60)

                const checkRendering = async () => {
                  attempts++;
                  const svgElement = tempChartContainer.querySelector('svg');
                  const canvasElement =
                    tempChartContainer.querySelector('canvas');

                  if (svgElement || canvasElement) {
                    console.log(
                      `Chart ${i + 1} rendered successfully (${
                        svgElement ? 'SVG' : 'Canvas'
                      }) after ${attempts * 500}ms`,
                    );

                    // Additional wait to ensure complete rendering
                    await new Promise(r => setTimeout(r, 1000));

                    clearTimeout(timeout);
                    resolve();
                  } else if (attempts >= maxAttempts) {
                    clearTimeout(timeout);
                    reject(
                      new Error(
                        `Chart ${i + 1} failed to render after ${
                          maxAttempts * 500
                        }ms`,
                      ),
                    );
                  } else {
                    // Check again after 500ms
                    setTimeout(checkRendering, 500);
                  }
                };

                // Start checking
                checkRendering();
              },
            );
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });

        updateProgress(
          `Converting chart ${i + 1} of ${chartElements.length}...`,
        );

        // Detect if chart is rendered with SVG or Canvas
        const svgElement = tempChartContainer.querySelector('svg');
        const canvasElement = tempChartContainer.querySelector('canvas');

        if (svgElement) {
          console.log(
            `Chart ${i + 1} rendered with SVG, using SVG directly...`,
          );

          // Clone the SVG to avoid modifying the original
          const clonedSvg = svgElement.cloneNode(true) as SVGElement;

          // Set explicit dimensions on SVG if not present
          if (!clonedSvg.getAttribute('width')) {
            clonedSvg.setAttribute('width', `${actualWidth}`);
          }
          if (!clonedSvg.getAttribute('height')) {
            clonedSvg.setAttribute('height', `${height}`);
          }

          // Add viewBox if not present for better scaling
          if (!clonedSvg.getAttribute('viewBox')) {
            clonedSvg.setAttribute('viewBox', `0 0 ${actualWidth} ${height}`);
          }

          // Ensure SVG preserves aspect ratio
          if (!clonedSvg.getAttribute('preserveAspectRatio')) {
            clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }

          clonedSvg.style.cssText = '';
          clonedSvg.style.border = '1px solid #ccc';
          clonedSvg.style.width = `${actualWidth}px`;
          clonedSvg.style.height = `${height}px`;

          console.log(`Chart ${i + 1} SVG cloned and configured`);
          chartEl.parentNode?.replaceChild(clonedSvg, chartEl);

          console.log(`Chart ${i + 1} replaced with SVG in container`);
        } else if (canvasElement) {
          console.log(
            `Chart ${i + 1} rendered with Canvas, converting to image...`,
          );

          // Capture the chart with higher resolution
          const canvas = await html2canvas(tempChartContainer, {
            scale: 4,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            allowTaint: true,
            imageTimeout: 0,
            // pixelRatio: window.devicePixelRatio * 6,
          });

          // Replace the super-chart element with the image
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png', 1.0);
          img.style.width = `${actualWidth}px`;
          img.style.height = `${height}px`;
          img.style.border = '1px solid #ccc';
          img.style.boxSizing = 'border-box';
          img.style.display = 'block';
          chartEl.parentNode?.replaceChild(img, chartEl);

          console.log(
            `Chart ${
              i + 1
            } replaced with Canvas image: ${actualWidth}x${height}`,
          );
        } else {
          throw new Error(`Chart ${i + 1} has no SVG or Canvas element`);
        }

        // Clean up the temporary container
        ReactDOM.unmountComponentAtNode(tempChartContainer);
        document.body.removeChild(tempChartContainer);

        console.log(
          `Chart ${i + 1}/${chartElements.length} processed successfully`,
        );

        // Small delay between charts to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing chart ${i + 1}:`, err);

        // Create a placeholder for failed chart
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = `${parseInt(
          chartEl.getAttribute('height') || '400',
          10,
        )}px`;
        placeholder.style.border = '1px solid #ccc';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.backgroundColor = '#f9f9f9';
        placeholder.style.color = '#666';
        placeholder.style.fontFamily = 'Arial, sans-serif';
        placeholder.textContent = `Chart ${i + 1} could not be rendered: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`;
        chartEl.parentNode?.replaceChild(placeholder, chartEl);

        // Continue with next chart even if this one fails
        console.log(`Continuing to next chart after error in chart ${i + 1}`);
      }
    }

    console.log(
      'All charts processed. Container after replacing images:',
      allPagesContainer,
    );

    updateProgress('Opening print dialog...');

    // Open a clean window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) {
      alert('Please allow pop-ups to export PDF');
      return;
    }

    const pdfHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print to PDF</title>
          <style>
            ${css}
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
            }
            img, svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${allPagesContainer.innerHTML}
        </body>
      </html>
    `;

    printWindow.document.write(pdfHtml);

    printWindow.document.close();

    // Wait for all resources to load before printing
    printWindow.onload = function () {
      console.log('Print window loaded, waiting before print...');
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        console.log('Print dialog opened');

        // Remove loading overlay after print dialog opens
        if (document.body.contains(loadingOverlay)) {
          document.body.removeChild(loadingOverlay);
        }

        // Optionally close the window after printing
        // setTimeout(() => { printWindow.close(); }, 1000);
      }, 1500);
    };

    // Clean up container
    if (document.body.contains(allPagesContainer)) {
      document.body.removeChild(allPagesContainer);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert(
      `Error generating PDF: ${
        error instanceof Error ? error.message : 'Unknown error'
      }. Please check console for details.`,
    );
  } finally {
    // Clean up loading overlay and style
    setTimeout(() => {
      if (document.body.contains(loadingOverlay)) {
        document.body.removeChild(loadingOverlay);
      }
    }, 2000);

    console.log('Export process completed');
  }
}

function AddChartBlock(editorInstance: Editor) {
  editorInstance.BlockManager.add('chart-block', {
    label: 'Chart',
    category: 'Widgets',
    // attributes: { class: 'far fa-chart-pie' },
    media: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24.875" viewBox="0 0 544 512"><!--!Font Awesome Free v5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M527.79 288H290.5l158.03 158.03c6.04 6.04 15.98 6.53 22.19.68 38.7-36.46 65.32-85.61 73.13-140.86 1.34-9.46-6.51-17.85-16.06-17.85zm-15.83-64.8C503.72 103.74 408.26 8.28 288.8.04 279.68-.59 272 7.1 272 16.24V240h223.77c9.14 0 16.82-7.68 16.19-16.8zM224 288V50.71c0-9.55-8.39-17.4-17.84-16.06C86.99 51.49-4.1 155.6.14 280.37 4.5 408.51 114.83 513.59 243.03 511.98c50.4-.63 96.97-16.87 135.26-44.03 7.9-5.6 8.42-17.23 1.57-24.08L224 288z"/></svg>',
    content: {
      type: 'chart-component',
    },
  });

  // Define the custom chart component (selector only)
  // editorInstance.DomComponents.addType('chart-component', {
  //   model: {
  //     defaults: {
  //       tagName: 'div',
  //       draggable: true,
  //       droppable: false,
  //       components: `
  //       <div style="padding: 20px; text-align: center;">
  //         <p>Loading chart options...</p>
  //       </div>
  //     `,
  //     },
  //     init() {
  //       // Open popup immediately when component is added to canvas
  //       setTimeout(() => {
  //         this.openChartModal();
  //       }, 100);
  //     },
  //     async openChartModal() {
  //       const modal = editorInstance.Modal;
  //       const component = this;

  //       // Show loading state
  //       modal.setTitle('Loading Charts...');
  //       modal.setContent(
  //         '<div style="padding: 40px; text-align: center;"><p>Fetching charts...</p></div>',
  //       );
  //       modal.open();

  //       try {
  //         // Fetch charts from Superset API
  //         const query = {
  //           columns: ['id', 'slice_name'],
  //         };

  //         const response = await SupersetClient.get({
  //           endpoint: `/api/v1/chart?q=${rison.encode(query)}`,
  //         });

  //         const charts = response.json?.result || [];

  //         if (charts.length === 0) {
  //           modal.setContent(
  //             '<div style="padding: 40px; text-align: center;"><p>No charts available</p></div>',
  //           );
  //           return;
  //         }

  //         // Generate modal content with chart cards
  //         const chartCards = charts
  //           .map(
  //             (chart: any) => `
  //         <div class="chart-card" data-chart-id="${chart.id}" data-chart-name="${chart.slice_name}" style="
  //           border: 2px solid #e0e0e0;
  //           border-radius: 8px;
  //           padding: 20px;
  //           text-align: center;
  //           cursor: pointer;
  //           transition: all 0.3s ease;
  //           background: white;
  //         ">
  //           <div style="font-size: 48px; color: #2196F3; margin-bottom: 10px;">
  //             📊
  //           </div>
  //           <h3 style="margin: 10px 0; color: #333; font-size: 16px; word-break: break-word;">${chart.slice_name}</h3>
  //           <p style="color: #999; font-size: 12px;">ID: ${chart.id}</p>
  //         </div>
  //       `,
  //           )
  //           .join('');

  //         const modalContent = `
  //         <div style="padding: 20px;">
  //           <h2 style="margin-bottom: 20px; text-align: center;">Select a Chart</h2>
  //           <div style="
  //             display: grid;
  //             grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  //             gap: 20px;
  //             max-height: 500px;
  //             overflow-y: auto;
  //             padding: 10px;
  //           ">
  //             ${chartCards}
  //           </div>
  //         </div>

  //         <style>
  //           .chart-card:hover {
  //             border-color: #2196F3 !important;
  //             transform: translateY(-5px);
  //             box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  //           }
  //         </style>
  //       `;

  //         modal.setTitle('Choose Chart');
  //         modal.setContent(modalContent);

  //         // Add click event listeners to chart cards
  //         setTimeout(() => {
  //           const chartCards = document.querySelectorAll('.chart-card');
  //           chartCards.forEach(card => {
  //             card.addEventListener('click', function () {
  //               const chartId = this.getAttribute('data-chart-id');
  //               const chartName = this.getAttribute('data-chart-name');
  //               component.selectChart(chartId, chartName);
  //               modal.close();
  //             });
  //           });
  //         }, 100);
  //       } catch (error) {
  //         console.error('Error fetching charts:', error);
  //         modal.setContent(`
  //         <div style="padding: 40px; text-align: center;">
  //           <p style="color: red;">Error loading charts. Please try again.</p>
  //           <p style="color: #666; font-size: 14px;">${error.message}</p>
  //         </div>
  //       `);
  //       }

  //       // Handle modal close without selection - remove component
  //       modal.onceClose(() => {
  //         if (!component.get('chart-id')) {
  //           component.remove();
  //         }
  //       });
  //     },
  //     selectChart(chartId: string, chartName: string) {
  //       // Replace this component with a super-chart component
  //       const parent = this.parent();
  //       const index = parent?.components().indexOf(this);

  //       // Remove the chart-component
  //       this.remove();

  //       // Add super-chart component at the same position
  //       parent?.append(
  //         {
  //           type: 'super-chart',
  //           attributes: {
  //             chartId: chartId,
  //             height: '400',
  //           },
  //         },
  //         { at: index },
  //       );
  //     },
  //   },
  // });

  // RP - List with right side preview
  // Define the custom chart component (selector only)
  editorInstance.DomComponents.addType('chart-component', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        components: `
        <div style="padding: 20px; text-align: center;">
          <p>Loading chart options...</p>
        </div>
      `,
      },
      init() {
        // Open popup immediately when component is added to canvas
        setTimeout(() => {
          this.openChartModal();
        }, 100);
      },
      async openChartModal() {
        const modal = editorInstance.Modal;
        const component = this;
        let selectedChartId = null;
        let selectedChartName = null;

        // Show loading state
        modal.setTitle('Loading Charts...');
        modal.setContent(
          '<div style="padding: 40px; text-align: center;"><p>Fetching charts...</p></div>',
        );
        modal.open();

        try {
          // Fetch charts from Superset API
          const query = {
            columns: ['id', 'slice_name'],
          };

          const response = await SupersetClient.get({
            endpoint: `/api/v1/chart?q=${rison.encode(query)}`,
          });

          const charts = response.json?.result || [];

          if (charts.length === 0) {
            modal.setContent(
              '<div style="padding: 40px; text-align: center;"><p>No charts available</p></div>',
            );
            return;
          }

          // Generate modal content with chart list
          const chartList = charts
            .map(
              (chart: any) => `
          <div class="chart-list-item" data-chart-id="${chart.id}" data-chart-name="${chart.slice_name}" style="
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #e0e0e0;
            cursor: pointer;
            transition: background 0.2s ease;
            background: white;
          ">
            <div style="font-size: 24px; color: #2196F3; margin-right: 12px;">
              📊
            </div>
            <div style="flex: 1;">
              <div style="font-size: 14px; color: #333; font-weight: 500;">${chart.slice_name}</div>
              <div style="font-size: 12px; color: #999; margin-top: 2px;">ID: ${chart.id}</div>
            </div>
          </div>
        `,
            )
            .join('');

          const modalContent = `
          <div style="display: flex; height: 600px; gap: 20px; padding: 20px;">
            <!-- Left side: Chart selection list -->
            <div style="width: 350px; display: flex; flex-direction: column; border-right: 2px solid #e0e0e0; padding-right: 20px;">
              <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #ffff;">Select a Chart</h2>
              <div style="
                position: relative;
                margin-bottom: 15px;
              ">
                <input
                  type="text"
                  id="chart-search"
                  placeholder="Search charts..."
                  style="
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                  "
                />
              </div>
              <div id="chart-list" style="
                flex: 1;
                overflow-y: auto;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
              ">
                ${chartList}
              </div>
            </div>

            <!-- Right side: Preview -->
            <div style="flex: 1; display: flex; flex-direction: column;">
              <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #ffff;">Preview</h2>
              <div id="chart-preview" style="
                width: 600px;
                height: 440px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px dashed #ccc;
                border-radius: 8px;
                background: #f9f9f9;
                color: #999;
                padding: 20px;
                overflow: hidden;
                box-sizing: border-box;
              ">
                <p>Select a chart to preview</p>
              </div>

              <!-- Action buttons -->
              <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-btn" class="btn btn-default">Cancel</button>
                <button id="confirm-btn" disabled class="btn btn-primary">Confirm</button>
              </div>
            </div>
          </div>

          <style>
            .chart-list-item:hover {
              background: #f5f5f5 !important;
            }
            .chart-list-item.selected {
              background: #e3f2fd !important;
              border-left: 3px solid #2196F3;
            }
            // #confirm-btn:not(:disabled) {
            //   opacity: 1;
            //   cursor: pointer;
            // }
            // #confirm-btn:not(:disabled):hover {
            //   background: #1976D2;
            // }
            // #cancel-btn:hover {
            //   background: #f5f5f5;
            // }
            #chart-list::-webkit-scrollbar {
              width: 8px;
            }
            #chart-list::-webkit-scrollbar-track {
              background: #f1f1f1;
            }
            #chart-list::-webkit-scrollbar-thumb {
              background: #888;
              border-radius: 4px;
            }
            #chart-list::-webkit-scrollbar-thumb:hover {
              background: #555;
            }
          </style>
        `;

          modal.setTitle('Choose Chart');
          modal.setContent(modalContent);

          // Function to render preview
          const renderPreview = async (chartId: string) => {
            const previewContainer = document.getElementById('chart-preview');
            if (!previewContainer) return;

            // Show loading state
            previewContainer.innerHTML = '<p>Loading preview...</p>';

            try {
              // Create a temporary div for React rendering
              const reactContainer = document.createElement('div');
              reactContainer.style.width = '100%';
              reactContainer.style.height = '100%';
              previewContainer.innerHTML = '';
              previewContainer.appendChild(reactContainer);

              // Render the chart preview
              ReactDOM.render(
                <SuperChartWrapper chartId={chartId} height={400} />,
                reactContainer,
              );
            } catch (error) {
              console.error('Error rendering preview:', error);
              previewContainer.innerHTML = `
              <div style="color: red; text-align: center;">
                <p>Failed to load preview</p>
                <p style="font-size: 12px;">${error.message}</p>
              </div>
            `;
            }
          };

          // Add event listeners
          setTimeout(() => {
            const chartListItems =
              document.querySelectorAll('.chart-list-item');
            const confirmBtn = document.getElementById('confirm-btn');
            const cancelBtn = document.getElementById('cancel-btn');
            const searchInput = document.getElementById('chart-search');

            // Chart selection handler
            chartListItems.forEach(item => {
              item.addEventListener('click', function () {
                const chartId = this.getAttribute('data-chart-id');
                const chartName = this.getAttribute('data-chart-name');

                // Update selection
                selectedChartId = chartId;
                selectedChartName = chartName;

                // Update UI
                chartListItems.forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');

                // Enable confirm button
                if (confirmBtn) {
                  confirmBtn.removeAttribute('disabled');
                }

                // Render preview
                renderPreview(chartId);
              });
            });

            // Search functionality
            if (searchInput) {
              searchInput.addEventListener('input', function (e) {
                const searchTerm = e.target.value.toLowerCase();
                chartListItems.forEach(item => {
                  const chartName = item
                    .getAttribute('data-chart-name')
                    .toLowerCase();
                  const chartId = item.getAttribute('data-chart-id');
                  if (
                    chartName.includes(searchTerm) ||
                    chartId.includes(searchTerm)
                  ) {
                    item.style.display = 'flex';
                  } else {
                    item.style.display = 'none';
                  }
                });
              });
            }

            // Confirm button handler
            if (confirmBtn) {
              confirmBtn.addEventListener('click', () => {
                if (selectedChartId && selectedChartName) {
                  component.selectChart(selectedChartId, selectedChartName);
                  modal.close();
                }
              });
            }

            // Cancel button handler
            if (cancelBtn) {
              cancelBtn.addEventListener('click', () => {
                modal.close();
              });
            }
          }, 100);
        } catch (error) {
          console.error('Error fetching charts:', error);
          modal.setContent(`
          <div style="padding: 40px; text-align: center;">
            <p style="color: red;">Error loading charts. Please try again.</p>
            <p style="color: #666; font-size: 14px;">${error.message}</p>
          </div>
        `);
        }

        // Handle modal close without selection - remove component
        modal.onceClose(() => {
          if (!component.get('chart-id')) {
            component.remove();
          }
        });
      },
      selectChart(chartId: string, chartName: string) {
        // Replace this component with a super-chart component
        const parent = this.parent();
        const index = parent?.components().indexOf(this);

        // Store chart info before removing
        this.set('chart-id', chartId);
        this.set('chart-name', chartName);

        // Remove the chart-component
        this.remove();

        // Add super-chart component at the same position
        parent?.append(
          {
            type: 'div',
            style: {
              width: '100%',
              padding: '10px',
              display: 'flex',
              'justify-content': 'center',
              // border: '1px solid #ddd',
            },
            droppable: false,
            components: [
              {
                type: 'super-chart',
                attributes: {
                  chartId: chartId,
                  height: '400',
                },
              }
            ]
          },
          { at: index },
        );
      },
    },
  });

  // RP - List with hover effect
  // editorInstance.DomComponents.addType('chart-component', {
  //   model: {
  //     defaults: {
  //       tagName: 'div',
  //       draggable: true,
  //       droppable: false,
  //       components: `
  //       <div style="padding: 20px; text-align: center;">
  //         <p>Loading chart options...</p>
  //       </div>
  //     `,
  //     },
  //     init() {
  //       // Open popup immediately when component is added to canvas
  //       setTimeout(() => {
  //         this.openChartModal();
  //       }, 100);
  //     },
  //     async openChartModal() {
  //       const modal = editorInstance.Modal;
  //       const component = this;

  //       // Show loading state
  //       modal.setTitle('Loading Charts...');
  //       modal.setContent(
  //         '<div style="padding: 40px; text-align: center;"><p>Fetching charts...</p></div>',
  //       );
  //       modal.open();

  //       try {
  //         // Fetch charts from Superset API
  //         const query = {
  //           columns: ['id', 'slice_name'],
  //         };

  //         const response = await SupersetClient.get({
  //           endpoint: `/api/v1/chart?q=${rison.encode(query)}`,
  //         });

  //         const charts = response.json?.result || [];

  //         if (charts.length === 0) {
  //           modal.setContent(
  //             '<div style="padding: 40px; text-align: center;"><p>No charts available</p></div>',
  //           );
  //           return;
  //         }

  //         // Generate modal content with chart cards
  //         const chartCards = charts
  //           .map(
  //             (chart: any) => `
  //         <div class="chart-card" data-chart-id="${chart.id}" data-chart-name="${chart.slice_name}" style="
  //           border: 2px solid #e0e0e0;
  //           border-radius: 8px;
  //           padding: 20px;
  //           text-align: center;
  //           cursor: pointer;
  //           transition: all 0.3s ease;
  //           background: white;
  //           position: relative;
  //         ">
  //           <div style="font-size: 48px; color: #2196F3; margin-bottom: 10px;">
  //             📊
  //           </div>
  //           <h3 style="margin: 10px 0; color: #333; font-size: 16px; word-break: break-word;">${chart.slice_name}</h3>
  //           <p style="color: #999; font-size: 12px;">ID: ${chart.id}</p>
  //         </div>
  //       `,
  //           )
  //           .join('');

  //         const modalContent = `
  //         <div style="padding: 20px;">
  //           <h2 style="margin-bottom: 20px; text-align: center;">Select a Chart</h2>
  //           <div class="charts-grid" style="
  //             display: grid;
  //             grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  //             gap: 20px;
  //             max-height: 500px;
  //             overflow-y: auto;
  //             padding: 10px;
  //             position: relative;
  //           ">
  //             ${chartCards}
  //           </div>
  //         </div>

  //         <!-- Preview container outside the grid -->
  //         <div id="chart-preview-portal" style="
  //           position: fixed;
  //           top: 0;
  //           left: 0;
  //           width: 100%;
  //           height: 100%;
  //           pointer-events: none;
  //           z-index: 999999;
  //         ">
  //           <div id="chart-preview-content" style="
  //             display: none;
  //             position: absolute;
  //             width: 600px;
  //             height: 400px;
  //             background: white;
  //             border: 2px solid #2196F3;
  //             border-radius: 8px;
  //             box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  //             padding: 15px;
  //             overflow: hidden;
  //             pointer-events: auto;
  //           ">
  //             <div class="preview-loading" style="
  //               display: flex;
  //               align-items: center;
  //               justify-content: center;
  //               height: 100%;
  //               color: #666;
  //             ">
  //               <div style="text-align: center;">
  //                 <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
  //                 <div>Loading preview...</div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>

  //         <style>
  //           .chart-card:hover {
  //             border-color: #2196F3 !important;
  //             transform: translateY(-5px) !important;
  //             box-shadow: 0 5px 15px rgba(0,0,0,0.1) !important;
  //             z-index: 1 !important;
  //           }

  //           .charts-grid {
  //             overflow-y: auto !important;
  //           }

  //           .chart-preview-container {
  //             width: 100%;
  //             height: 100%;
  //           }
  //         </style>
  //       `;

  //         modal.setTitle('Choose Chart');
  //         modal.setContent(modalContent);

  //         // Add hover and click event listeners to chart cards
  //         setTimeout(() => {
  //           const chartCards = document.querySelectorAll('.chart-card');
  //           const previewPortal = document.getElementById(
  //             'chart-preview-portal',
  //           );
  //           const previewContent = document.getElementById(
  //             'chart-preview-content',
  //           );
  //           const loadedPreviews = new Map();
  //           let currentChartId = null;

  //           chartCards.forEach(card => {
  //             const chartId = card.getAttribute('data-chart-id');
  //             const chartName = card.getAttribute('data-chart-name');
  //             let hoverTimeout: any = null;

  //             // Hover to show preview
  //             card.addEventListener('mouseenter', async function (e) {
  //               // Delay preview loading slightly to avoid loading on quick hovers
  //               hoverTimeout = setTimeout(async () => {
  //                 currentChartId = chartId;

  //                 // Position the preview near the card
  //                 const rect = card.getBoundingClientRect();
  //                 const previewWidth = 600;
  //                 const previewHeight = 400;

  //                 // Calculate position (to the right of the card, or left if not enough space)
  //                 let left = rect.right + 10;
  //                 if (left + previewWidth > window.innerWidth) {
  //                   left = rect.left - previewWidth - 10;
  //                 }

  //                 // Center vertically relative to the card
  //                 let top = rect.top + rect.height / 2 - previewHeight / 2;

  //                 // Ensure it stays within viewport
  //                 if (top < 10) top = 10;
  //                 if (top + previewHeight > window.innerHeight) {
  //                   top = window.innerHeight - previewHeight - 10;
  //                 }

  //                 previewContent.style.left = left + 'px';
  //                 previewContent.style.top = top + 'px';
  //                 previewContent.style.display = 'block';

  //                 // Only load the chart if it hasn't been loaded yet
  //                 if (!loadedPreviews.has(chartId)) {
  //                   try {
  //                     // Create a container for the SuperChartWrapper
  //                     const chartContainer = document.createElement('div');
  //                     chartContainer.className = 'chart-preview-container';
  //                     chartContainer.id = `chart-preview-${chartId}`;

  //                     // Clear loading message and append chart container
  //                     previewContent.innerHTML = '';
  //                     previewContent.appendChild(chartContainer);

  //                     ReactDOM.render(
  //                       <SuperChartWrapper chartId={chartId} height={370} />,
  //                       chartContainer,
  //                     );

  //                     loadedPreviews.set(chartId, chartContainer);
  //                   } catch (error) {
  //                     console.error('Error loading chart preview:', error);
  //                     previewContent.innerHTML = `
  //                     <div style="
  //                       display: flex;
  //                       align-items: center;
  //                       justify-content: center;
  //                       height: 100%;
  //                       color: #f44336;
  //                       font-size: 14px;
  //                       padding: 10px;
  //                       text-align: center;
  //                     ">
  //                       <div>
  //                         <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
  //                         <div>Failed to load preview</div>
  //                       </div>
  //                     </div>
  //                   `;
  //                   }
  //                 } else {
  //                   // Show the already loaded preview
  //                   const existingContainer = loadedPreviews.get(chartId);
  //                   previewContent.innerHTML = '';
  //                   previewContent.appendChild(existingContainer);
  //                 }
  //               }, 300);
  //             });

  //             // Hide preview on mouse leave
  //             card.addEventListener('mouseleave', function () {
  //               clearTimeout(hoverTimeout);
  //               setTimeout(() => {
  //                 if (currentChartId === chartId) {
  //                   previewContent.style.display = 'none';
  //                 }
  //               }, 100);
  //             });

  //             // Click to select chart
  //             card.addEventListener('click', function () {
  //               component.selectChart(chartId, chartName);
  //               modal.close();
  //             });
  //           });

  //           // Keep preview visible when hovering over it
  //           previewContent.addEventListener('mouseenter', function () {
  //             previewContent.style.display = 'block';
  //           });

  //           previewContent.addEventListener('mouseleave', function () {
  //             previewContent.style.display = 'none';
  //             currentChartId = null;
  //           });

  //           // Cleanup on modal close
  //           modal.onceClose(() => {
  //             loadedPreviews.forEach(container => {
  //               try {
  //                 ReactDOM.unmountComponentAtNode(container);
  //               } catch (e) {
  //                 console.error('Error unmounting chart preview:', e);
  //               }
  //             });
  //             loadedPreviews.clear();
  //           });
  //         }, 100);
  //       } catch (error) {
  //         console.error('Error fetching charts:', error);
  //         modal.setContent(`
  //         <div style="padding: 40px; text-align: center;">
  //           <p style="color: red;">Error loading charts. Please try again.</p>
  //           <p style="color: #666; font-size: 14px;">${error.message}</p>
  //         </div>
  //       `);
  //       }

  //       // Handle modal close without selection - remove component
  //       modal.onceClose(() => {
  //         if (!component.get('chart-id')) {
  //           component.remove();
  //         }
  //       });
  //     },
  //     selectChart(chartId: string, chartName: string) {
  //       const parent = this.parent();
  //       const index = parent?.components().indexOf(this);

  //       this.remove();

  //       parent?.append(
  //         {
  //           type: 'super-chart',
  //           attributes: {
  //             chartId: chartId,
  //             height: '400',
  //           },
  //         },
  //         { at: index },
  //       );
  //     },
  //   },
  // });
}

function AddSuperChartBlock(editorInstance: Editor) {
  editorInstance.BlockManager.add('superchart-static', {
    label: 'SuperChart (static)',
    category: 'Widgets',
    attributes: { class: 'fa fa-pie-chart' },
    content: {
      type: 'super-chart',
      attributes: {
        id: 12,
        // width: '600',
        height: '400',
      },
      resizable: true, // Enable resizing
    },
  });

  // 2️⃣ Add component type in DomComponents (renders React directly)
  editorInstance.DomComponents.addType('super-chart', {
    isComponent: el => el.tagName?.toLowerCase() === 'super-chart',
    model: {
      defaults: {
        tagName: 'super-chart',
        resizable: {
          tl: 1,
          tr: 1,
          bl: 1,
          br: 1,
          minDim: 100,
        },
        style: {
          display: 'inline-block',
          width: '100%',
          border: '1px solid #ccc',
        },
        attributes: {
          chartId: 12,
          height: '400',
        },
      },

      init() {
        // this.on('change:style', () => {
        //   console.log('Style changed, re-rendering chart');
        //   // this.syncDimensionsToAttributes();
        //   const el = this.view?.el;
        //   if (el) this.renderChart(el);
        // });
      },

      renderChart(el) {
        const attributes = this.getAttributes();
        const chartId = attributes.chartId;
        const height = parseInt(attributes.height, 10) || 400;

        console.log('Rendering chart with ID:', chartId);

        // Unmount previous render if exists
        ReactDOM.unmountComponentAtNode(el);

        // Render with wrapper component
        ReactDOM.render(
          <SuperChartWrapper chartId={chartId} height={height} />,
          // <SuperChartWrapperWithStatic chartId={chartId} height={height} />,
          el,
        );
      },
    },

    view: {
      onRender({ el, model }) {
        model.renderChart(el);
      },
    },
  });
}

// function AddSuperChartBlock(editorInstance: Editor) {
//   const defaultTheme: SupersetTheme = {
//     colors: {
//       grayscale: {
//         base: '#444',
//         dark2: '#222',
//       },
//     },
//     typography: {
//       families: {
//         sansSerif: 'Arial, sans-serif',
//       },
//       sizes: {
//         s: 12,
//         m: 14,
//         l: 16,
//       },
//     },
//   };

//   editorInstance.BlockManager.add('superchart-static', {
//     label: 'SuperChart (static)',
//     category: 'Widgets',
//     attributes: { class: 'fa fa-pie-chart' },
//     content: {
//       type: 'super-chart',
//       attributes: {
//         id: 12,
//         charttype: 'echarts-pie',
//         // width: '600',
//         height: '400',
//         formdata:
//           '{"compare_lag":"10","compare_suffix":"o10Y","granularity_sqla":"ds","groupby":["gender"],"limit":"25","markup_type":"markdown","metric":"sum__num","row_limit": 50000,"time_range":"100 years ago : now","viz_type":"pie"}',
//         queriesdata:
//           '[{"data":[{"gender":"boy","sum__num":48133355},{"gender":"girl","sum__num":32546308}]}]',
//       },
//       resizable: true, // Enable resizing
//     },
//     //         content: `<super-chart
//     //   charttype="echarts-pie"
//     //   width="600"
//     //   height="400"
//     //   formdata='{"compare_lag":"10","compare_suffix":"o10Y","granularity_sqla":"ds","groupby":["gender"],"limit":"25","markup_type":"markdown","metric":"sum__num","row_limit": 50000,"time_range":"100 years ago : now","viz_type":"pie"}'
//     //   queriesdata='[{"data":[{"gender":"boy","sum__num":48133355},{"gender":"girl","sum__num":32546308}]}]'
//     // ></super-chart>
//     // `,
//     // Make the block non-editable in the editor canvas by default
//     // so it remains a static tag. Users can still select/remove it.
//     // activate: 1,
//   });

//   // 2️⃣ Add component type in DomComponents (renders React directly)
//   editorInstance.DomComponents.addType('super-chart', {
//     isComponent: el => el.tagName?.toLowerCase() === 'super-chart',
//     model: {
//       defaults: {
//         tagName: 'super-chart',
//         resizable: {
//           tl: 1,
//           tr: 1,
//           bl: 1,
//           br: 1,
//           minDim: 100,
//         },
//         style: {
//           display: 'inline-block',
//           width: '100%',
//           // height: '400px',
//           // border: '1px solid #ccc',
//         },
//         attributes: {
//           id: 12,
//           // width: '600',
//           height: '400',
//           charttype: 'echarts-pie',
//           formdata:
//             '{"groupby":["gender"],"metrics":[{"label":"sum__num"}],"viz_type":"pie"}',
//           queriesdata:
//             '[{"data":[{"gender":"boy","sum__num":48133355},{"gender":"girl","sum__num":32546308}]}]',
//         },
//       },

//       init() {
//         // this.on('change:style', () => {
//         //   console.log('Style changed, re-rendering chart');
//         //   // this.syncDimensionsToAttributes();
//         //   const el = this.view?.el;
//         //   if (el) this.renderChart(el);
//         // });
//       },

//       renderChart(el) {

//         // const chartType = el.getAttribute('charttype');
//         // const width = parseInt(el.getAttribute('width'), 10) || 600;
//         // const height = parseInt(el.getAttribute('height'), 10) || 400;
//         // const formData = JSON.parse(el.getAttribute('formdata'));
//         // const queriesData = JSON.parse(el.getAttribute('queriesdata'));

//         const attributes = this.getAttributes();

//         // const chartType = attributes.charttype;
//         // // const width = parseInt(attributes.width, 10) || 600;
//         // const height = parseInt(attributes.height, 10) || 400;
//         // const formData = JSON.parse(attributes.formdata);
//         // const queriesData = JSON.parse(attributes.queriesdata);

//         // ReactDOM.render(
//         //   <SuperChart
//         //     chartType={chartType}
//         //     // width={width}
//         //     height={height}
//         //     formData={formData}
//         //     queriesData={queriesData}
//         //     theme={defaultTheme}
//         //     postTransformProps={chartProps => ({
//         //       ...chartProps,
//         //       echartOptions: {
//         //         ...chartProps.echartOptions,
//         //         renderer: 'svg', // or 'canvas'
//         //       },
//         //     })}
//         //   />,
//         //   el,
//         // );

//         const chartId = attributes.id;
//         let chartType = '';
//         let height = 400;
//         let formData = undefined;
//         let queriesData = undefined;

//         SupersetClient.get({
//           endpoint: `/api/v1/chart/${chartId}`,
//         }).then(({ json }) => {
//           if(json?.result?.viz_type === 'pie')
//             chartType = 'echarts-pie';
//           formData = JSON.parse(json?.result?.params);
//           SupersetClient.get({
//             endpoint: `/api/v1/chart/${chartId}/data`,
//           }).then(({ json }) => {
//             queriesData = json?.result[0]?.data;

//             console.log('chartId = ', chartId);
//             console.log('chartType = ', chartType);
//             console.log('formData = ', formData);
//             console.log('queriesData = ', queriesData);
//             console.log('defaultTheme = ', defaultTheme);

//             ReactDOM.render(
//               <SuperChart
//                 chartType={chartType}
//                 // width={width}
//                 height={height}
//                 formData={formData}
//                 queriesData={queriesData}
//                 theme={supersetTheme}
//                 postTransformProps={chartProps => ({
//                   ...chartProps,
//                   echartOptions: {
//                     ...chartProps.echartOptions,
//                     renderer: 'svg', // or 'canvas'
//                   },
//                 })}
//               />,
//               el,
//             );
//           });
//         });

//       },
//     },

//     view: {
//       onRender({ el, model }) {
//         model.renderChart(el);
//       },
//     },
//   });
// }

function AddCustomCodeBlock(editorInstance: Editor) {
  // Create a custom command for code editing
  editorInstance.Commands.add('open-code-editor', {
    run: (editor, sender, options = {}) => {
      const { component } = options;
      if (!component) return;

      // Get current code
      const currentCode = component.getAttributes().code || 'Insert your code';

      // Create modal for code editing
      const modal = editor.Modal;
      modal.setTitle('Insert your code');

      // Create textarea for code
      const container = document.createElement('div');
      const textarea = document.createElement('textarea');
      textarea.value = currentCode;
      textarea.style.width = '100%';
      textarea.style.height = '400px';
      textarea.style.padding = '8px';
      textarea.style.boxSizing = 'border-box';
      textarea.style.fontSize = '14px';
      textarea.style.fontFamily = 'monospace';
      container.appendChild(textarea);

      // Add save button
      const saveBtn = document.createElement('button');
      saveBtn.innerHTML = 'Save';
      saveBtn.style.marginTop = '10px';
      saveBtn.style.padding = '8px 16px';
      saveBtn.style.backgroundColor = '#4CAF50';
      saveBtn.style.color = 'white';
      saveBtn.style.border = 'none';
      saveBtn.style.cursor = 'pointer';
      saveBtn.style.borderRadius = '4px';
      saveBtn.onclick = () => {
        component.set('attributes', {
          ...component.getAttributes(),
          code: textarea.value,
        });
        component.view.render();
        modal.close();
      };
      container.appendChild(saveBtn);

      // Set modal content and open
      modal.setContent(container);
      modal.open();

      return true;
    },
  });

  // Add custom code component type with resizable content support
  editorInstance.DomComponents.addType('custom-code', {
    model: {
      defaults: {
        name: 'Custom Code',
        traits: [
          {
            type: 'button',
            name: 'edit-code',
            text: 'Edit Code',
            full: true,
            command: 'open-code-editor',
          },
          {
            type: 'number',
            name: 'width',
            label: 'Width (px)',
            placeholder: 'Auto',
            min: 50,
            changeProp: true,
          },
          {
            type: 'number',
            name: 'height',
            label: 'Height (px)',
            placeholder: 'Auto',
            min: 50,
            changeProp: true,
          },
        ],
        attributes: { class: 'custom-code-component' },
        droppable: false,
        resizable: true, // Enable resizing
        width: 'auto',
        height: 'auto',
      },
      init() {
        this.on('change:attributes:code', this.handleCodeChange);
        this.on('change:width', this.updateDimensions);
        this.on('change:height', this.updateDimensions);
      },
      handleCodeChange() {
        const code = this.getAttributes().code || '';
        this.set('content', code);
      },
      updateDimensions() {
        const width = this.get('width');
        const height = this.get('height');

        const style = { ...this.getStyle() };

        if (width && width !== 'auto') {
          style.width = `${width}px`;
        }

        if (height && height !== 'auto') {
          style.height = `${height}px`;
        }

        this.setStyle(style);
      },
    },
    view: {
      onRender({ el }) {
        const code =
          this.model.getAttributes().code || 'Insert here your custom code';

        // Create a container div for the code content
        const container = document.createElement('div');
        container.className = 'custom-code-container';
        container.innerHTML = code;

        // Clear the element and append the container
        el.innerHTML = '';
        el.appendChild(container);

        // Process any iframes to make them resizable
        const iframes = el.querySelectorAll('iframe');
        if (iframes.length) {
          iframes.forEach(iframe => {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
          });
        }
      },
      init() {
        // Open code editor when the component is first added
        const model = this.model;
        model.trigger('active');
        setTimeout(() => {
          this.em.get('Commands').run('open-code-editor', { component: model });
        }, 100);

        // Add resize observers
        this.listenTo(this.model, 'change:width change:height', this.render);
      },
    },
  });

  // Add custom code block
  editorInstance.BlockManager.add('custom-code-block', {
    label: 'Custom Code',
    category: 'Extra',
    media: `<svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path d="M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z" />
               </svg>`,
    content: {
      type: 'custom-code',
      attributes: { code: 'Insert here your custom code' },
      resizable: true, // Enable resizing
      style: {
        padding: '10px',
        border: '1px solid #ddd',
        backgroundColor: '#f9f9f9',
        minHeight: '100px',
        minWidth: '200px',
        overflow: 'auto', // Add overflow to handle content
      },
    },
  });
}

function AddOneColumnBlock(editorInstance: Editor)
{
  // Add the block
  editorInstance.BlockManager.add('one-column', {
    label: 'One Column',
    category: 'Basic',
    media: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-columns-1"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 3m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" /></svg>`,
    content: {
      type: 'div',
      style: {
        width: '100%',
        padding: '10px',
        display: 'flex',
        'justify-content': 'center',
        // border: '1px solid #ddd',
      },
    },
  });
}

function AddTwoColumnBlock(editorInstance: Editor) {
  // Define custom component type with resizable enabled
  editorInstance.DomComponents.addType('resizable-column', {
    model: {
      defaults: {
        draggable: true,
        droppable: true,
        // removable: false, // Prevent individual column deletion
        // selectable: true, // Prevent direct selection - will select parent instead
        resizable: {
          tl: 0, // Top left
          tc: 0, // Top center
          tr: 0, // Top right
          cl: 0, // Center left
          cr: 1, // Center right - enable only right side resize
          bl: 0, // Bottom left
          bc: 0, // Bottom center
          br: 0, // Bottom right
          minDim: 50,
        },
        style: {
          // 'min-height': '100px',
          'box-sizing': 'border-box',
        },
      },
    },
  });

  // Define the container component
  editorInstance.DomComponents.addType('two-column-container', {
    model: {
      defaults: {
        draggable: true,
        droppable: false,
        removable: true, // Allow container deletion
        selectable: true, // Allow container selection
        style: {
          display: 'flex',
          'min-height': '100px',
          width: '100%',
          // padding: '10px',
        },
        components: [
          {
            type: 'resizable-column',
            draggable: false,
            removable: false, // Prevent deletion of first column
            selectable: true, // Prevent direct selection
            style: {
              width: '50%',
              padding: '10px',
              border: '1px solid #ddd',
            },
          },
          {
            type: 'resizable-column',
            draggable: false,
            removable: false, // Prevent deletion of second column
            selectable: false, // Prevent direct selection
            resizable: false,
            style: {
              flex: '1',
              padding: '10px',
              border: '1px solid #ddd',
            },
          },
        ],
      },
    },
  });

  // Add the block
  editorInstance.BlockManager.add('two-column', {
    label: 'Two Columns',
    category: 'Basic',
    media: `<svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M11,3H3V21H11V3M13,3V21H21V3H13Z" />
            </svg>`,
    content: {
      type: 'two-column-container',
    },
  });
}

function AddImageBlock(editorInstance: Editor) {
  editorInstance.BlockManager.add('image-block', {
    label: 'Image',
    category: 'Basic',
    media: `<svg style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" /></svg>`,
    content: {
      type: 'image',
      style: {
        'max-width': '100%',
        height: 'auto',
      },
    },
    activate: true,
  });
}

function AddTextBoxBlock(editorInstance: Editor) {
  // Add text box block
  editorInstance.BlockManager.add('text-box', {
    label: 'Text Box',
    category: 'Basic',
    media: `<svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path d="M18.5,4L19.66,8.35L18.7,8.61C18.25,7.74 17.79,6.87 17.26,6.43C16.73,6 16.11,6 15.5,6H13V16.5C13,17 13,17.5 13.33,17.75C13.67,18 14.33,18 15,18V19H9V18C9.67,18 10.33,18 10.67,17.75C11,17.5 11,17 11,16.5V6H8.5C7.89,6 7.27,6 6.74,6.43C6.21,6.87 5.75,7.74 5.3,8.61L4.34,8.35L5.5,4H18.5Z" />
                </svg>`,
    content: {
      type: 'text',
      content: 'Edit this text',
      style: {
        padding: '10px',
        margin: '0',
        'font-size': '16px',
        'min-height': '50px',
      },
    },
  });
}

function HideDevicesMenu(editorInstance: Editor) {
  editorInstance.on('load', () => {
    editorInstance.Panels.removePanel('devices-c');
  });

  // Method - 1 (Old but works): Clear device list to hide device manager
  /*
  // Additional cleanup to ensure device manager is removed
  // This will run after initialization
  setTimeout(() => {
    // Try to remove the device manager panel and buttons
    if (editorInstance.Panels) {
      editorInstance.Panels.getPanels().forEach(panel => {
        if (panel?.get('id') === 'devices-c') {
          editorInstance.Panels.removePanel(panel);
        }
      });
    }

    // Hide device manager via CSS if it still exists
    const deviceManager = document.querySelector('.gjs-pn-devices-c');
    if (deviceManager) {
      deviceManager.style.display = 'none';
    }
  }, 100);

  // Add custom CSS to hide device manager and enhance custom code components
  const style = document.createElement('style');
  style.innerHTML = `
        // .gjs-pn-devices-c, 
        // .gjs-devices-c, 
        // .gjs-device-label {
        //   display: none !important;
        // }
        
        // .custom-code-component {
        //   position: relative;
        //   min-height: 50px;
        //   min-width: 100px;
        //   overflow: auto;
        // }
        
        // .custom-code-container {
        //   width: 100%;
        //   height: 100%;
        //   overflow: auto;
        // }
        
        // .custom-code-container iframe {
        //   border: none;
        //   width: 100%;
        //   height: 100%;
        // }
      `;
  document.head.appendChild(style);
  */
}

function UpdateOptionsPanel(editorInstance: Editor) {
  // Add print button to the panel
  editorInstance.Panels.getPanel('options')?.buttons.add([
    {
      id: 'undo-action',
      className: 'fa fa-undo',
      command: 'core:undo',
      attributes: { title: 'Undo (Ctrl+Z)' },
    },
    {
      id: 'redo-action',
      className: 'fa fa-repeat',
      command: 'core:redo',
      attributes: { title: 'Redo (Ctrl+Y)' },
    },
    {
      id: 'clear-canvas',
      className: 'fa fa-trash',
      command: 'core:canvas-clear',
      attributes: { title: 'Clear Canvas' },
    },
    {
      id: 'export-pdf',
      className: 'fa fa-file-pdf',
      command: 'export-to-pdf',
      attributes: { title: 'Export to PDF' },
    },
  ]);

  // ✅ fa fa-square → exists in Font Awesome 5/6.

  // ❌ fa fa-square-o → was removed after Font Awesome 4.

  // GrapesJS uses Font Awesome 5+, so fa-square-o no longer works.
  // Update visibility toggle icon
  const visibilityBtn = editorInstance.Panels.getButton('options', 'sw-visibility');
  if (visibilityBtn) {
    visibilityBtn.set('className', 'far fa-square');
  }
}

function ConfigureRichTextEditor(editorInstance: Editor) {
  // Add custom list actions after initialization
  editorInstance.RichTextEditor.add('unorderedList', {
    icon: '&bull;',
    attributes: { title: 'Unordered List' },
    result: rte => rte.exec('insertUnorderedList')
  });
}

function makeFrameScrollable(editor: Editor, width = '794px', height = '1123px') {
  const frameEl = editor.Canvas.getFrameEl();
  const canvasEl = editor.Canvas.getElement();
  const frameBody = editor.Canvas.getBody();

  const wrapperDiv = frameBody?.querySelector('div[data-gjs-type="wrapper"]') as HTMLElement;

  console.log("frameEl = ", frameEl, " frameBody = ", frameBody, " wrapperDiv = ", wrapperDiv)

  if (wrapperDiv) {
    wrapperDiv.style.height = height;
  }

  if (frameEl) {
    frameEl.style.width = width;
    frameEl.style.overflow = 'auto';
  }
}
export default Test;
