import { useState, useMemo } from 'react'
import Layout from '../components/Layout'

const rawData = [
  { name: 'Tiger Nixon', position: 'System Architect', office: 'Edinburgh', age: 61, startDate: '2011/04/25', salary: 320800 },
  { name: 'Garrett Winters', position: 'Accountant', office: 'Tokyo', age: 63, startDate: '2011/07/25', salary: 170750 },
  { name: 'Ashton Cox', position: 'Junior Technical Author', office: 'San Francisco', age: 66, startDate: '2009/01/12', salary: 86000 },
  { name: 'Cedric Kelly', position: 'Senior Javascript Developer', office: 'Edinburgh', age: 22, startDate: '2012/03/29', salary: 433060 },
  { name: 'Airi Satou', position: 'Accountant', office: 'Tokyo', age: 33, startDate: '2008/11/28', salary: 162700 },
  { name: 'Brielle Williamson', position: 'Integration Specialist', office: 'New York', age: 61, startDate: '2012/12/02', salary: 372000 },
  { name: 'Herrod Chandler', position: 'Sales Assistant', office: 'San Francisco', age: 59, startDate: '2012/08/06', salary: 137500 },
  { name: 'Rhona Davidson', position: 'Integration Specialist', office: 'Tokyo', age: 55, startDate: '2010/10/14', salary: 327900 },
  { name: 'Colleen Hurst', position: 'Javascript Developer', office: 'San Francisco', age: 39, startDate: '2009/09/15', salary: 205500 },
  { name: 'Sonya Frost', position: 'Software Engineer', office: 'Edinburgh', age: 23, startDate: '2008/12/13', salary: 103600 },
  { name: 'Jena Gaines', position: 'Office Manager', office: 'London', age: 30, startDate: '2008/12/19', salary: 90560 },
  { name: 'Quinn Flynn', position: 'Support Lead', office: 'Edinburgh', age: 22, startDate: '2013/03/03', salary: 342000 },
  { name: 'Charde Marshall', position: 'Regional Director', office: 'San Francisco', age: 36, startDate: '2008/10/16', salary: 470600 },
  { name: 'Haley Kennedy', position: 'Senior Marketing Designer', office: 'London', age: 43, startDate: '2012/12/18', salary: 313500 },
  { name: 'Tatyana Fitzpatrick', position: 'Regional Director', office: 'London', age: 19, startDate: '2010/03/17', salary: 385750 },
  { name: 'Michael Silva', position: 'Marketing Designer', office: 'London', age: 66, startDate: '2012/11/27', salary: 198500 },
  { name: 'Paul Byrd', position: 'Chief Financial Officer (CFO)', office: 'New York', age: 64, startDate: '2010/06/09', salary: 725000 },
  { name: 'Gloria Little', position: 'Systems Administrator', office: 'New York', age: 59, startDate: '2009/04/10', salary: 237500 },
  { name: 'Bradley Greer', position: 'Software Engineer', office: 'London', age: 41, startDate: '2012/10/13', salary: 132000 },
  { name: 'Dai Rios', position: 'Personnel Lead', office: 'Edinburgh', age: 35, startDate: '2012/09/26', salary: 217500 },
  { name: 'Jenette Caldwell', position: 'Development Lead', office: 'New York', age: 30, startDate: '2011/09/03', salary: 345000 },
  { name: 'Yuri Berry', position: 'Chief Marketing Officer (CMO)', office: 'New York', age: 40, startDate: '2009/06/25', salary: 675000 },
  { name: 'Caesar Vance', position: 'Pre-Sales Support', office: 'New York', age: 21, startDate: '2011/12/12', salary: 106450 },
  { name: 'Doris Wilder', position: 'Sales Assistant', office: 'Sidney', age: 23, startDate: '2010/09/20', salary: 85600 },
  { name: 'Angelica Ramos', position: 'Chief Executive Officer (CEO)', office: 'London', age: 47, startDate: '2009/10/09', salary: 1200000 },
  { name: 'Gavin Joyce', position: 'Developer', office: 'Edinburgh', age: 42, startDate: '2010/12/22', salary: 92575 },
  { name: 'Jennifer Chang', position: 'Regional Director', office: 'Singapore', age: 28, startDate: '2010/11/14', salary: 357650 },
  { name: 'Brenden Wagner', position: 'Software Engineer', office: 'San Francisco', age: 28, startDate: '2011/06/07', salary: 206850 },
  { name: 'Fiona Green', position: 'Chief Operating Officer (COO)', office: 'San Francisco', age: 48, startDate: '2010/03/11', salary: 850000 },
  { name: 'Shou Itou', position: 'Regional Marketing', office: 'Tokyo', age: 20, startDate: '2011/08/14', salary: 163000 },
  { name: 'Michelle House', position: 'Integration Specialist', office: 'Sidney', age: 37, startDate: '2011/06/02', salary: 95400 },
  { name: 'Suki Burks', position: 'Developer', office: 'London', age: 53, startDate: '2009/10/22', salary: 114500 },
  { name: 'Prescott Bartlett', position: 'Technical Author', office: 'London', age: 27, startDate: '2011/05/07', salary: 145000 },
  { name: 'Gavin Cortez', position: 'Team Leader', office: 'San Francisco', age: 22, startDate: '2008/10/26', salary: 235500 },
  { name: 'Martena Mccray', position: 'Post-Sales support', office: 'Edinburgh', age: 46, startDate: '2011/03/09', salary: 324050 },
  { name: 'Unity Butler', position: 'Marketing Designer', office: 'San Francisco', age: 47, startDate: '2009/12/09', salary: 85675 },
  { name: 'Howard Hatfield', position: 'Office Manager', office: 'San Francisco', age: 51, startDate: '2008/12/16', salary: 164500 },
  { name: 'Hope Fuentes', position: 'Secretary', office: 'San Francisco', age: 41, startDate: '2010/02/12', salary: 109850 },
  { name: 'Vivian Harrell', position: 'Financial Controller', office: 'San Francisco', age: 62, startDate: '2009/02/14', salary: 452500 },
  { name: 'Timothy Mooney', position: 'Office Manager', office: 'London', age: 37, startDate: '2008/12/11', salary: 136200 },
  { name: 'Jackson Bradshaw', position: 'Director', office: 'New York', age: 65, startDate: '2008/09/26', salary: 645750 },
  { name: 'Olivia Liang', position: 'Support Engineer', office: 'Singapore', age: 64, startDate: '2011/02/03', salary: 234500 },
  { name: 'Bruno Nash', position: 'Software Engineer', office: 'London', age: 38, startDate: '2011/05/03', salary: 163500 },
  { name: 'Sakura Yamamoto', position: 'Support Engineer', office: 'Tokyo', age: 37, startDate: '2009/08/19', salary: 139575 },
  { name: 'Thor Walton', position: 'Developer', office: 'New York', age: 61, startDate: '2013/08/11', salary: 98540 },
  { name: 'Finn Camacho', position: 'Support Engineer', office: 'San Francisco', age: 47, startDate: '2009/07/07', salary: 87500 },
  { name: 'Serge Baldwin', position: 'Data Coordinator', office: 'Singapore', age: 64, startDate: '2012/04/09', salary: 138575 },
  { name: 'Zenaida Frank', position: 'Software Engineer', office: 'New York', age: 63, startDate: '2010/01/04', salary: 125250 },
  { name: 'Zorita Serrano', position: 'Software Engineer', office: 'San Francisco', age: 56, startDate: '2012/06/01', salary: 115000 },
  { name: 'Jennifer Acosta', position: 'Junior Javascript Developer', office: 'Edinburgh', age: 43, startDate: '2013/02/01', salary: 75650 },
  { name: 'Cara Stevens', position: 'Sales Assistant', office: 'New York', age: 46, startDate: '2011/12/06', salary: 145600 },
  { name: 'Hermione Butler', position: 'Regional Director', office: 'London', age: 47, startDate: '2011/03/21', salary: 356250 },
  { name: 'Lael Greer', position: 'Systems Administrator', office: 'London', age: 21, startDate: '2009/02/27', salary: 103500 },
  { name: 'Jonas Alexander', position: 'Developer', office: 'San Francisco', age: 30, startDate: '2010/07/14', salary: 86500 },
  { name: 'Shad Decker', position: 'Regional Director', office: 'Edinburgh', age: 51, startDate: '2008/11/13', salary: 183000 },
  { name: 'Michael Bruce', position: 'Javascript Developer', office: 'Singapore', age: 29, startDate: '2011/06/27', salary: 183000 },
  { name: 'Donna Snider', position: 'Customer Support', office: 'New York', age: 27, startDate: '2011/01/25', salary: 112000 },
]

const PAGE_SIZES = [10, 25, 50, 100]
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Position' },
  { key: 'office', label: 'Office' },
  { key: 'age', label: 'Age' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'salary', label: 'Salary', render: (v) => `$${v.toLocaleString()}` },
]

export default function DataTable() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rawData.filter(row =>
      columns.some(col => String(row[col.key]).toLowerCase().includes(q))
    )
  }, [search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const dir = sortDir === 'asc' ? 1 : -1
      if (typeof av === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="dt-sort dt-sort--both"><i className="ti-arrows-vertical" /></span>
    return <span className="dt-sort dt-sort--active"><i className={`ti-arrow-${sortDir === 'asc' ? 'up' : 'down'}`} /></span>
  }

  return (
    <Layout>
      <div className="page-header">
        <h4 className="page-title">Data Tables</h4>
        <nav className="breadcrumb">
          <span>Home</span>
          <i className="ti-angle-right" />
          <span>Tables</span>
          <i className="ti-angle-right" />
          <span className="active">Data Table</span>
        </nav>
      </div>

      <div className="card">
        <div className="card__header"><h6 className="card__title">Bootstrap Data Table</h6></div>
        <div className="card__body">

          {/* Table Controls */}
          <div className="dt-controls">
            <div className="dt-controls__left">
              <label>
                Show&nbsp;
                <select className="dt-select" value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1) }}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                &nbsp;entries
              </label>
            </div>
            <div className="dt-controls__right">
              <label>
                Search:&nbsp;
                <input className="dt-search" type="text" value={search} onChange={handleSearch} placeholder="Search..." />
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table table--datatable">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)} className="dt-th">
                      {col.label} <SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={6} className="dt-empty">No matching records found</td></tr>
                ) : paginated.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'dt-row--odd'}>
                    {columns.map(col => (
                      <td key={col.key}>{col.render ? col.render(row[col.key]) : row[col.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Info + Controls */}
          <div className="dt-footer">
            <div className="dt-info">
              Showing {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} entries
              {search && ` (filtered from ${rawData.length} total entries)`}
            </div>
            <div className="dt-pagination">
              <button className="dt-page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="dt-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = page - 2 + i
                if (p < 1) p = i + 1
                if (p > totalPages) p = totalPages - (4 - i)
                if (p < 1 || p > totalPages) return null
                return (
                  <button key={p} className={`dt-page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                )
              })}
              <button className="dt-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="dt-page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  )
}
