// src/pages/OutageViewPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const OutageViewPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`http://172.16.11.241:5000/api/outage/${id}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        alert("Failed to load outage data");
        setLoading(false);
      });
  }, [id]);

  const handleChange = (field, value) => {
    setData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`http://172.16.11.241:5000/api/outage/${id}`, data);
      alert("Outage updated successfully ✅");
    } catch (err) {
      alert("Failed to save changes ❌");
    }
    setSaving(false);
  };

  if (loading || !data) return <div className="p-6 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white border shadow-lg mt-10">
      <h1
        className={`text-xl font-bold text-center py-2 mb-4 ${
          data.currentStatus === "Closed"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        MTN Outage Alert
      </h1>

      <table className="w-full text-sm border border-gray-300">
        <tbody className="[&>tr>td]:border [&>tr>td]:border-gray-200 [&>tr>td]:p-2 [&>tr:nth-child(odd)]:bg-gray-100">

          <tr>
            <td className="font-semibold">Incident Number</td>
            <td>
              <input
                type="text"
                value={data.incidentNumber}
                onChange={(e) => handleChange("incidentNumber", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Location Impacted</td>
            <td>
              <input
                type="text"
                value={Array.isArray(data.locationImpacted) ? data.locationImpacted.join(", ") : data.locationImpacted}
                onChange={(e) =>
                  handleChange("locationImpacted", e.target.value.split(",").map((s) => s.trim()))
                }
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Problem Details</td>
            <td>
              <textarea
                value={data.problemDetails}
                onChange={(e) => handleChange("problemDetails", e.target.value)}
                rows={3}
                className="w-full px-2 py-1 border rounded whitespace-pre-wrap resize-y"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Incident Start Time</td>
            <td>
              <input
                type="text"
                value={data.incidentStartTime}
                onChange={(e) => handleChange("incidentStartTime", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Incident End Time</td>
            <td>
              <input
                type="text"
                value={data.incidentEndTime || ""}
                onChange={(e) => handleChange("incidentEndTime", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Incident Duration (in min)</td>
            <td>
              <input
                type="text"
                value={data.incidentDuration || ""}
                onChange={(e) => handleChange("incidentDuration", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Current Status</td>
            <td>
              <select
                value={data.currentStatus}
                onChange={(e) => handleChange("currentStatus", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Severity</td>
            <td>
              <input
                type="text"
                value={data.severity}
                onChange={(e) => handleChange("severity", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">App Segment</td>
            <td>
              <input
                type="text"
                value={Array.isArray(data.appSegment) ? data.appSegment.join(", ") : data.appSegment}
                onChange={(e) =>
                  handleChange("appSegment", e.target.value.split(",").map((s) => s.trim()))
                }
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Business Impact</td>
            <td>
              <textarea
                value={data.businessImpact}
                onChange={(e) => handleChange("businessImpact", e.target.value)}
                rows={2}
                className="w-full px-2 py-1 border rounded whitespace-pre-wrap resize-y"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">RCA (Cause)</td>
            <td>
              <input
                type="text"
                value={Array.isArray(data.rca) ? data.rca.join(", ") : data.rca}
                onChange={(e) => handleChange("rca", e.target.value.split(",").map((s) => s.trim()))}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Impacted Service</td>
            <td>
              <input
                type="text"
                value={Array.isArray(data.impactedService) ? data.impactedService.join(", ") : data.impactedService}
                onChange={(e) =>
                  handleChange("impactedService", e.target.value.split(",").map((s) => s.trim()))
                }
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">Sequence Of Events</td>
            <td>
              <textarea
                value={data.sequenceOfEvents}
                onChange={(e) => handleChange("sequenceOfEvents", e.target.value)}
                rows={4}
                className="w-full px-2 py-1 border rounded whitespace-pre-wrap resize-y"
              />
            </td>
          </tr>

          <tr>
            <td className="font-semibold">War room</td>
            <td>
              <input
                type="text"
                value={data.warRoom || ""}
                onChange={(e) => handleChange("warRoom", e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-center font-semibold text-yellow-700 mt-4">
        Apologies for any inconvenience caused.
      </p>

      <div className="text-center mt-6 flex justify-between">
        <Link to="/outages" className="text-blue-500 hover:underline">
          ← Back to List
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${
            saving ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default OutageViewPage;
