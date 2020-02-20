import * as fs from 'fs'
import * as path from 'path'
import xray from 'x-ray'

const loadingSpinner = require('loading-spinner')

const x = xray({
  filters: {
    trim: function (value) {
      return typeof value === 'string' ? value.trim() : value
    },
    default: function (value) {
      return typeof value === 'string' ? value : ''
    }
  }
})

async function rip (domain, route) {
  process.stdout.write(`started ripping ${domain} \n`)
  loadingSpinner.start(100, {
    clearChar: true
  })
  // tslint:disable-next-line: await-promise
  const values = await x(`${domain}${route}`,
    '.m-exhibitors-list__items__item',
    [{
      name: 'a.m-exhibitors-list__items__item__header__title__link | trim',
      stand: 'div.m-exhibitors-list__items__item__header__meta__stand | trim',
      img: 'img@src',
      link: '@data-slug'
    }]
  )
  .paginate('a.pagination__list__item__link--next@href')
  const promisedValues = values.map(async v => {
  // tslint:disable-next-line: await-promise
    const page = await x(
    `${domain}${v.link}`,
      {
        description: '.m-exhibitor-entry__item__body__description | trim',
        address: '.m-exhibitor-entry__item__body__contacts__address | trim',
        website: '.m-exhibitor-entry__item__body__contacts__additional__button__website a@href',
        social: ['.m-exhibitor-entry__item__body__contacts__additional__social__item a@href']
      }
  )

    return {
      ...v,
      ...page
    }
  })
  const normalizedValues = await Promise.all<any>(promisedValues)
  process.stdout.write(`finished ripping ${domain} \n`)
  loadingSpinner.stop()
  return normalizedValues
}

async function compile () {
  const v1 = await rip('https://www.cloudexpoeurope.com/', 'exhibitors')
  const v2 = await rip('https://www.cloudsecurityexpo.com/', '2020-exhibitors')
  const v3 = await rip('https://www.smartiotlondon.com/', 'exhibitors')
  const v4 = await rip('https://www.datacentreworld.com/', '2020-exhibitor-list')
  saveToHTML([...v1, ...v2, ...v3, ...v4])
}

// tslint:disable-next-line: no-floating-promises
compile()

function saveToHTML (data: any) {
  process.stdout.write(`started writing \n`)
  loadingSpinner.start(100, {
    clearChar: true
  })
  const template = `
    <html>
      <head>
        <link rel="stylesheet" href="https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css" />
        <link rel="stylesheet" href="https://cdn.datatables.net/buttons/1.6.1/css/buttons.dataTables.min.css" />
        <style>
          td {
            vertical-align: top;
          }
        </style>
      </head>
      <body>
        <table id="example" class="display" style="width:100%;table-layout:fixed;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stand</th>
              <th>Description</th>
              <th>Address</th>
              <th>Website</th>
              <th>Social</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.map(v => {
                return `
                  <tr>
                    <td><b>${v.name}</b></td>
                    <td>${v.stand ? v.stand : ''}</td>
                    <td>${v.description ? v.description : ''}</td>
                    <td>${v.address ? v.address.replace('Address', '') : ''}</td>
                    <td>${v.website ? `<a href="${v.website}">${v.website}</a>` : ''}</td>
                    <td>${v.social ? v.social.map(d => `<a href="${d}">${d}</a>`).join('\n') : ''}</td>
                  </tr>
                `
              })
            }
          </tbody>
          <tfoot>
            <tr>
              <th>Name</th>
              <th>Stand</th>
              <th>Description</th>
              <th>Address</th>
              <th>Website</th>
              <th>Social</th>
            </tr>
          </tfoot>
        </table>
        <script src="https://code.jquery.com/jquery-3.3.1.js"></script>
        <script src="https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js"></script>
        <script src="https://cdn.datatables.net/buttons/1.6.1/js/dataTables.buttons.min.js"></script>
        <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.flash.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.3/jszip.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/pdfmake.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/vfs_fonts.js"></script>
        <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.html5.min.js"></script>
        <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.print.min.js"></script>
        <script>
          $(document).ready(function() {
            $('#example').DataTable({
              paging: false,
              ordering: false,
              info: false,
              dom: 'Bfrtip',
              buttons: ['copy', 'csv', 'excel', 'pdf', 'print']
            });
          });
        </script>
      </body>
    </html>
  `
  fs.writeFileSync(path.join(__dirname, 'output', 'result.html'), template)
  process.stdout.write(`finished writing \n`)
  loadingSpinner.stop()
}
