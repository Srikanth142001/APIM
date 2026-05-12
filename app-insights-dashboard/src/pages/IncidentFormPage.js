import React, { useState } from "react";

const IncidentFormPage = () => {
  const [formData, setFormData] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://172.16.11.241:5000/api/Incident/view-IncidentFormPage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        alert("✅ Incident submitted successfully!");
        console.log("Server Response:", result);

        // Reset form after success
        setFormData({});
      } else {
        alert("❌ Failed to submit incident!");
        console.error("Error response:", result);
      }
    } catch (err) {
      console.error("Request failed:", err);
      alert("❌ Error submitting incident!");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center bg-blue-600 text-white py-3 rounded-2xl shadow-md">
        Incident / Outage Reporting Form
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Incident Details */}
        <section className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Incident Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <input name="index" placeholder="Index" className="border p-2 rounded" onChange={handleChange} />
            <input name="location" placeholder="Location" className="border p-2 rounded" onChange={handleChange} />
            <input name="opco" placeholder="Opco" className="border p-2 rounded" onChange={handleChange} />
            <input name="environment" placeholder="Environment" className="border p-2 rounded" onChange={handleChange} />
            <input name="appSegment" placeholder="App Segment" className="border p-2 rounded" onChange={handleChange} />
            <input name="subject" placeholder="Subject" className="border p-2 rounded" onChange={handleChange} />
            <textarea name="problemStatement" placeholder="Problem Statement" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <input name="issueCategory" placeholder="Issue Category" className="border p-2 rounded" onChange={handleChange} />
            <select name="s1s2" className="border p-2 rounded" onChange={handleChange}>
              <option value="">S1 or S2</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
            </select>
            <input name="capturedBy" placeholder="Captured By" className="border p-2 rounded" onChange={handleChange} />
            <input name="shiftSpoc" placeholder="Shift SPOC" className="border p-2 rounded" onChange={handleChange} />
            <input type="date" name="incidentDate" className="border p-2 rounded" onChange={handleChange} />
            <input name="ticketId" placeholder="Ticket ID" className="border p-2 rounded" onChange={handleChange} />
            <input type="time" name="startTime" className="border p-2 rounded" onChange={handleChange} />
            <input type="time" name="endTime" className="border p-2 rounded" onChange={handleChange} />
            <input name="issueStatus" placeholder="Issue Status" className="border p-2 rounded" onChange={handleChange} />
            <input name="falsePositive" placeholder="False Positive/No Actual Outage" className="border p-2 rounded" onChange={handleChange} />
          </div>
        </section>

        {/* RCA */}
        <section className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Root Cause Analysis (RCA)</h2>
          <div className="grid grid-cols-2 gap-4">
            <input name="issueCaptureType" placeholder="Issue Capture Type" className="border p-2 rounded" onChange={handleChange} />
            <input name="toolUsed" placeholder="Tool Used To Capture" className="border p-2 rounded" onChange={handleChange} />
            <textarea name="manualReason" placeholder="If Manual Capture, Reason" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <textarea name="rcaDetail" placeholder="RCA Detail" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <select name="rcaShared" className="border p-2 rounded" onChange={handleChange}>
              <option value="">RCA Shared?</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            <input name="rcaSharedStatus" placeholder="RCA Shared Status" className="border p-2 rounded" onChange={handleChange} />
            <input name="rcaResponsibleParty" placeholder="RCA Responsible Party" className="border p-2 rounded" onChange={handleChange} />
            <input name="rcaReviewedBy" placeholder="RCA Reviewed By" className="border p-2 rounded" onChange={handleChange} />
          </div>
        </section>

        {/* Impact & Mitigation */}
        <section className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Impact & Mitigation</h2>
          <div className="grid grid-cols-2 gap-4">
            <textarea name="mitigationDetails" placeholder="Mitigation Details" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <textarea name="riskIdentification" placeholder="Risk Identification" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <textarea name="permanentFix" placeholder="Permanent Fix & Preventive Action (CAPA)" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <textarea name="remark" placeholder="Remark" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <textarea name="businessImpact" placeholder="Business Impact" className="border p-2 rounded col-span-2" onChange={handleChange} />
            <select name="ticketClosed" className="border p-2 rounded" onChange={handleChange}>
              <option value="">Ticket Closed?</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            <input type="number" name="incidentDuration" placeholder="Incident Duration (mins)" className="border p-2 rounded" onChange={handleChange} />
            <input type="number" name="trafficDeviation" placeholder="Traffic Deviation %" className="border p-2 rounded" onChange={handleChange} />
            <input name="outageFilledBy" placeholder="Outage details filled by" className="border p-2 rounded" onChange={handleChange} />
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-center">
          <button type="submit" className="px-6 py-2 bg-green-600 text-white font-semibold rounded-xl shadow hover:bg-green-700">
            Submit Incident
          </button>
        </div>
      </form>
    </div>
  );
};

export default IncidentFormPage;
