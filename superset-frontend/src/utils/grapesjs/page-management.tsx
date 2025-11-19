import { Page } from 'grapesjs';
import { v4 as uuidv4 } from 'uuid';

export function handleAddPage(
  editor: any,
  setSelectedPage: (id: string | number) => void,
  pageHeight: number,
) {
  if (editor) {
    const totalPages = editor.Pages.getAll().length;

    const newPage = getNewPage(totalPages+1, pageHeight);

    // Add the new page
    editor.Pages.add(newPage);

    // Select the newly created page
    editor.Pages.select(newPage.id);
    setSelectedPage(newPage.id);
  }
}

export function handlePageSelect(
  editor: any,
  pageId: string | number,
  setSelectedPage: (id: string | number) => void,
) {
  if (editor && pageId) {
    const page = editor.Pages.get(pageId);
    if (page) {
      editor.Pages.select(pageId);
      setSelectedPage(pageId);
    }
  }
}

export function handleDeletePage(
  editor: any,
  pageId: string | number,
  index: number,
  e: any,
  pages: Page[],
  selectedPage: string | number | undefined,
  setSelectedPage: (id: string | number) => void,
) {
  e.stopPropagation(); // Prevent triggering page selection

  if (editor) {
    // Don't allow deleting the last page
    if (pages.length <= 1) {
      alert('Cannot delete the last page');
      return;
    }

    // Confirm deletion
    if (window.confirm(`Are you sure you want to delete page with ID: "${pageId}"?`)) {
      // If deleting the currently selected page, select another page first
      if (selectedPage === pageId) {
        // Find another page to select
        const otherPage = pages.find(page => page.id !== pageId);
        if (otherPage) {
          editor.Pages.select(otherPage.id);
          setSelectedPage(otherPage.id);
        }
      }

      // Remove the page
      editor.Pages.remove(pageId);

      adjustFooterPageNumber(editor, index);
    }
  }
}

export function handleDragStart(
  page: Page,
  index: number,
  setDraggedPage: React.Dispatch<React.SetStateAction<Page | undefined>>,
  setDraggedPageSourceIndex: React.Dispatch<
    React.SetStateAction<number | undefined>
  >,
) {
  setDraggedPage(page);
  setDraggedPageSourceIndex(index);
}

export function handleDragOver(
  e: any,
  index: number,
  setDraggedPageTargetIndex: React.Dispatch<
    React.SetStateAction<number | undefined>
  >,
) {
  e.preventDefault();
  setDraggedPageTargetIndex(index);
}

export function handleDragLeave(
  setDraggedPageTargetIndex: React.Dispatch<
    React.SetStateAction<number | undefined>
  >,
) {
  setDraggedPageTargetIndex(undefined);
}

export function handleDrop(
  editor: any,
  e: any,
  draggedPageSourceIndex: number | undefined,
  draggedPageTargetIndex: number | undefined,
  draggedPage: Page | undefined,
  setDraggedPage: React.Dispatch<React.SetStateAction<Page | undefined>>,
  setDraggedPageTargetIndex: React.Dispatch<
    React.SetStateAction<number | undefined>
  >,
) {
  e.preventDefault();

  if (
    draggedPage &&
    editor &&
    draggedPageSourceIndex != undefined &&
    draggedPageTargetIndex != undefined
  ) {
    if (draggedPageSourceIndex !== draggedPageTargetIndex) {
      editor.Pages.move(draggedPage, { at: draggedPageTargetIndex });

      let startIndex =
        draggedPageSourceIndex < draggedPageTargetIndex
          ? draggedPageSourceIndex
          : draggedPageTargetIndex;

      adjustFooterPageNumber(editor, startIndex);
    }
  }

  // Reset drag state
  setDraggedPage(undefined);
  setDraggedPageTargetIndex(undefined);
}

function adjustFooterPageNumber(editor: any, startIndex: number)
{
  let pages: Page[] = editor.Pages.getAll();

  for (let index = startIndex; index < pages.length; index++) {
    var page = pages[index];

    page.setName(`Page-${index+1}`);

    let rootComponent = page.getMainComponent();

    // Change footer content
    rootComponent
      .components()
      .at(2) // It will find footer element.
      .components()
      .at(0) // It will find 'p' element inside the footer.
      .components(String(index + 1));
  }
}

export function getNewPage(pageNumber: number, pageHeight: number) {
  // Generate a unique page ID
  const newPageId = `${uuidv4()}`;
  const newPage = {
    id: newPageId,
    name: `Page-${pageNumber}`,
    // styles: '.new-page { color: #333; }',
    // component: '<div>New Page Content</div>',
    component: {
      tagName: 'div',
      style: {
        'min-height': `${pageHeight}px`,
        display: 'flex',
        'flex-direction': 'column',
      },
      components: [
        // Header
        getPageHeaderComponent(),
        // Main Content
        getPageMainComponent(),
        // Footer
        getPageFooterComponent(pageNumber),
      ],
    },
  };

  return newPage;
}

export function getPageHeaderComponent() {
  const pageHeaderComponent = {
    tagName: 'header',
    attributes: { 'data-gjs-type': 'header' },
    removable: false,
    draggable: false,
    copyable: false,
    style: {
      'background-color': '#f8f9fa',
      padding: '20px',
      // 'border-bottom': '2px solid #dee2e6',
      position: 'relative',
      top: '0',
      left: '0',
      right: '0',
      'z-index': '1000',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'flex-start',
      height: '25mm',
    },
    components: [
      {
        type: 'image',
        attributes: {
          class: 'header-logo',
          src: '/static/assets/branding/odmd-logo-horiz.png', // Replace with your logo URL
          alt: 'Company Logo',
        },
        removable: false,
        draggable: false,
        copyable: false,
        selectable: false,
        hoverable: false,
        editable: false,
        layerable: false,
        style: {
          'max-height': '50px',
          width: 'auto',
        },
      },
    ],
  };

  return pageHeaderComponent;
}

export function getPageMainComponent() {
  const pageMainComponent = {
    tagName: 'main',
    style: {
      flex: '1',
      // 'min-height': `calc(${pageHeight}px - 12mm - 25mm)`,
      // 'max-height': `calc(${pageHeight}px - 12mm - 15mm)`,
      // padding: '0 12mm',
    },
    removable: false,
    draggable: false,
    copyable: false,
    components: [
      {
        tagName: 'div',
        style: { 'max-width': '1200px', margin: '0 auto' },
        components: [
          { tagName: 'h2', content: 'Welcome to Our Website' },
          {
            tagName: 'p',
            content: 'This is the main content area. Add your content here.',
          },
        ],
      },
    ],
  };

  return pageMainComponent;
}

export function getPageFooterComponent(pageNumber: number) {
  const pageFooterComponent = {
    tagName: 'footer',
    attributes: { 'data-gjs-type': 'footer' },
    removable: false,
    draggable: false,
    copyable: false,
    style: {
      'background-color': '#f8f9fa',
      // 'border-top': '2px solid #dee2e6',
      padding: '10px 20px',
      'text-align': 'right',
      height: '12mm',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'flex-end',
    },
    components: [
      {
        tagName: 'p',
        content: `${pageNumber}`,
        style: { margin: '0' },
      },
    ],
  };

  return pageFooterComponent;
}
