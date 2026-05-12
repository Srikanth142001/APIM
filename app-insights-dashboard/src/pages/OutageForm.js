// src/pages/OutageFormPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";

// Options
const locationOptions = [
  { value: "GH", label: "GH" },
  { value: "CDI", label: "CDI" },
  { value: "UG", label: "UG" },
  { value: "NGS", label: "NGS" },
  { value: "CMR", label: "CMR" },
  { value: "LI", label: "LI" },
  { value: "SW", label: "SW" },
  { value: "ZM", label: "ZM" },
  { value: "CB", label: "CB" },
  { value: "MyMTN CMR", label: "MyMTN CMR" },
  { value: "BJ", label: "BJ" },
];

const impactedServiceOptions = [
  { value: "Consumer", label: "Consumer" },
  { value: "Business", label: "Business" },
  { value: "Agent", label: "Agent" },
  { value: "Merchant", label: "Merchant" },
  { value: "Rebalancer", label: "Rebalancer" },
];

const appSegmentOptions = [
  { value: "Nexgen", label: "Nexgen" },
  { value: "Legacy", label: "Legacy" },
];

const rcaOptions = [
  { value: "pending", label: "Pending" },
  { value: "party-comviva", label: "Comviva" },
  { value: "Accenture", label: "Accenture" },
  { value: "MTN", label: "MTN" },
  { value: "ECW", label: "ECW" },
];

// React-select dark theme styles
const customSelectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    borderColor: "#374151",
    color: "white",
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    color: "white",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#2563eb" : "#1f2937",
    color: "white",
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#374151",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "white",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#9ca3af",
    ":hover": { backgroundColor: "#374151", color: "white" },
  }),
  input: (base) => ({ ...base, color: "white" }),
  singleValue: (base) => ({ ...base, color: "white" }),
  placeholder: (base) => ({ ...base, color: "#9ca3af" }),
};

const OutageFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    incidentNumber: "",
    locationImpacted: [],
    problemDetails: "",
    incidentStartTime: "",
    incidentEndTime: "",
    incidentDuration: "",
    currentStatus: "",
    severity: "",
    businessImpact: "",
    rca: [],
    impactedService: [],
    sequenceOfEvents: "",
    appSegment: [],
  });

  // Load data if editing
  useEffect(() => {
    if (id) {
      setLoading(true);
      axios
        .get(`http://172.16.11.241:5000/api/outage/${id}`)
        .then((res) => {
          const data = res.data;
          setFormData({
            ...data,
            locationImpacted:
              data.locationImpacted?.map((loc) => ({ value: loc, label: loc })) ||
              [],
            appSegment:
              data.appSegment?.map((seg) => ({ value: seg, label: seg })) || [],
            impactedService:
              data.impactedService?.map((s) => ({ value: s, label: s })) || [],
            rca: data.rca?.map((r) => ({ value: r, label: r })) || [],
          });
          setLoading(false);
        })
        .catch(() => {
          alert("Failed to load outage data");
          setLoading(false);
        });
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const payload = {
      ...formData,
      locationImpacted: formData.locationImpacted.map((o) => o.value),
      impactedService: formData.impactedService.map((o) => o.value),
      appSegment: formData.appSegment.map((o) => o.value),
      rca: formData.rca.map((o) => o.value),
    };

    try {
      if (id) {
        await axios.put(`http://172.16.11.241:5000/api/outage/${id}`, payload);
        alert("Outage updated successfully!");
      } else {
        await axios.post("http://172.16.11.241:5000/api/outage", payload);
        alert("Outage created successfully!");
      }
      navigate("/outages");
    } catch (error) {
      if (
        error.response &&
        error.response.status === 400 &&
        error.response.data.error === "Maximum 5 records allowed"
      ) {
        setErrorMessage(
          "⚠️ Limit reached: Only 5 outage records allowed. Please delete or update existing ones."
        );
      } else {
        setErrorMessage("❌ Error saving data. Please try again.");
      }
    }
  };

  if (loading)
    return <div className="text-white text-center mt-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-semibold text-blue-300">
            {id ? "Edit Outage" : "Add New Outage"}
          </h2>
          <button
            type="button"
            onClick={() => navigate("/outages")}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
          >
            🔍 View Outages
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-900 text-red-300 px-4 py-3 rounded mb-6 text-center">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Incident Number */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Incident Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="incidentNumber"
              value={formData.incidentNumber}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="INC12345"
            />
          </div>

          {/* Problem Details */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Problem Details <span className="text-red-500">*</span>
            </label>
            <textarea
              name="problemDetails"
              value={formData.problemDetails}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700 resize-y"
              placeholder="Describe the problem..."
            />
          </div>

          {/* RCA */}
          <div>
            <label className="block text-sm font-medium mb-1">RCA</label>
            <Select
              isMulti
              options={rcaOptions}
              value={formData.rca}
              onChange={(selected) =>
                setFormData((p) => ({ ...p, rca: selected }))
              }
              styles={customSelectStyles}
            />
          </div>

          {/* Sequence of Events */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Sequence of Events
            </label>
            <textarea
              name="sequenceOfEvents"
              value={formData.sequenceOfEvents}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700 resize-y"
              placeholder="Step by step events..."
            />
          </div>

          {/* Business Impact */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Business Impact <span className="text-red-500">*</span>
            </label>
            <select
              name="businessImpact"
              value={formData.businessImpact}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
            >
              <option value="">Select impact</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {/* Impact Services */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Impact Services <span className="text-red-500">*</span>
            </label>
            <Select
              isMulti
              options={impactedServiceOptions}
              value={formData.impactedService}
              onChange={(selected) =>
                setFormData((p) => ({ ...p, impactedService: selected }))
              }
              styles={customSelectStyles}
            />
          </div>

          {/* Incident Start */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Incident Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="incidentStartTime"
              value={formData.incidentStartTime}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="2025-08-29 14:30"
            />
          </div>

          {/* Incident End */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Incident End Time
            </label>
            <input
              type="text"
              name="incidentEndTime"
              value={formData.incidentEndTime}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="2025-08-29 16:00"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Incident Duration
            </label>
            <input
              type="text"
              name="incidentDuration"
              value={formData.incidentDuration}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
              placeholder="E.g., 2 hrs 15 mins"
            />
          </div>

          {/* App Segment */}
          <div>
            <label className="block text-sm font-medium mb-1">App Segment</label>
            <Select
              isMulti
              options={appSegmentOptions}
              value={formData.appSegment}
              onChange={(selected) =>
                setFormData((p) => ({ ...p, appSegment: selected }))
              }
              styles={customSelectStyles}
            />
          </div>

          {/* Location Impacted */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Location Impacted <span className="text-red-500">*</span>
            </label>
            <Select
              isMulti
              options={locationOptions}
              value={formData.locationImpacted}
              onChange={(selected) =>
                setFormData((p) => ({ ...p, locationImpacted: selected }))
              }
              styles={customSelectStyles}
              required
            />
          </div>

          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Current Status <span className="text-red-500">*</span>
            </label>
            <select
              name="currentStatus"
              value={formData.currentStatus}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
            >
              <option value="">Select status</option>
              <option value="Open">Open</option>
              <option value="Work in Progress">Work in Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Severity <span className="text-red-500">*</span>
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded bg-gray-900 border border-gray-700"
            >
              <option value="">Select severity</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
            </select>
          </div>

          {/* Submit */}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition"
            >
              {id ? "Update Outage" : "Create Outage"}
            </button>
          </div>

          {/* Cancel */}
          <div className="md:col-span-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/outages")}
              className="text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutageFormPage;
