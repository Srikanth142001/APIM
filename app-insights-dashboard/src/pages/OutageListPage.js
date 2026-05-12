import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

const OutageListPage = () => {
  const [outages, setOutages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://172.16.11.241:5000/api/outage')
      .then(res => {
        setOutages(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load outages', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-white text-center mt-10">Loading outages...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-3xl font-semibold text-blue-300 mb-6 text-center">All Outages</h2>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-semibold text-blue-300">
            Add New Outage
          </h2>
          <button
            type="button"
            onClick={() => navigate('/OutageForm')}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
          >
            🔍 Create Outages
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-900 border border-gray-700 rounded-lg">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left px-4 py-2">Incident #</th>
                <th className="text-left px-4 py-2">Location</th>
                <th className="text-left px-4 py-2">Severity</th>
                <th className="text-left px-4 py-2">Start Time</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Edit</th>
                <th className="text-left px-4 py-2">View</th>
              </tr>
            </thead>
            <tbody>
              {outages.map(outage => (
                <tr key={outage.id} className="border-t border-gray-700 hover:bg-gray-800">
                  <td className="px-4 py-2">{outage.incidentNumber}</td>
                  <td className="px-4 py-2">{outage.locationImpacted}</td>
                  <td className="px-4 py-2">{outage.severity}</td>
                  <td className="px-4 py-2">{new Date(outage.incidentStartTime).toLocaleString()}</td>
                  <td className="px-4 py-2">{outage.currentStatus}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/edit-outage/${outage.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      Edit
                    </Link>
                    </td>
                    <td className="px-4 py-2">
                    <Link
                        to={`/view-outage/${outage.id}`}
                        className="text-green-500 hover:underline"
                        >
                        View
                    </Link>

                  </td>
                </tr>
              ))}
              {outages.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-gray-400 py-4">No outages found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OutageListPage;
