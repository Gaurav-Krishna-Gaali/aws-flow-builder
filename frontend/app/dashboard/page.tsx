'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// Types
interface Workflow {
  stateMachineArn: string;
  name: string;
  status?: string;
  creationDate?: Date;
  definition?: unknown;
  type?: string;
}

interface Execution {
  executionArn: string;
  name?: string;
  status: string;
  startDate: Date;
  stopDate?: Date;
  stateMachineArn?: string;
}

interface ExecutionDetails extends Execution {
  input?: unknown;
  output?: unknown;
  error?: string;
  cause?: string;
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedWorkflowForExecution, setSelectedWorkflowForExecution] = useState<Workflow | null>(null);
  const [executionInput, setExecutionInput] = useState('{}');
  const [isStartingExecution, setIsStartingExecution] = useState(false);
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetails | null>(null);
  const [workflowExecutions, setWorkflowExecutions] = useState<Record<string, Execution[]>>({});
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState<Record<string, boolean>>({});
  const [exportFormat, setExportFormat] = useState<'json' | 'yaml'>('json');
  const [showExportModal, setShowExportModal] = useState(false);
  const [workflowToExport, setWorkflowToExport] = useState<Workflow | null>(null);
  const [isStoppingExecution, setIsStoppingExecution] = useState<string | null>(null);

  // Mock data for demonstration (replace with actual API call)
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      // In production, this would be: fetch(`${API_BASE_URL}/state-machines`)
      // For now, using mock data
      const mockWorkflows: Workflow[] = [
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:OrderProcessing',
          name: 'OrderProcessing',
          status: 'ACTIVE',
          creationDate: new Date('2024-01-15'),
          type: 'STANDARD',
        },
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:DataPipeline',
          name: 'DataPipeline',
          status: 'ACTIVE',
          creationDate: new Date('2024-01-20'),
          type: 'STANDARD',
        },
        {
          stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:NotificationService',
          name: 'NotificationService',
          status: 'ACTIVE',
          creationDate: new Date('2024-02-01'),
          type: 'EXPRESS',
        },
      ];
      setWorkflows(mockWorkflows);
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.stateMachineArn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleWorkflowSelection = (arn: string) => {
    setSelectedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(arn)) {
        next.delete(arn);
      } else {
        next.add(arn);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWorkflows.size === filteredWorkflows.length) {
      setSelectedWorkflows(new Set());
    } else {
      setSelectedWorkflows(new Set(filteredWorkflows.map((w) => w.stateMachineArn)));
    }
  };

  const handleDeleteClick = (arn: string) => {
    setWorkflowToDelete(arn);
    setShowDeleteModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedWorkflows.size === 0) return;
    setWorkflowToDelete(Array.from(selectedWorkflows)[0]);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!workflowToDelete) return;

    setIsDeleting(true);
    try {
      // Delete single workflow
      if (selectedWorkflows.size <= 1) {
        const response = await fetch(
          `${API_BASE_URL}/state-machines?stateMachineArn=${encodeURIComponent(workflowToDelete)}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          setWorkflows((prev) => prev.filter((w) => w.stateMachineArn !== workflowToDelete));
          setSelectedWorkflows((prev) => {
            const next = new Set(prev);
            next.delete(workflowToDelete);
            return next;
          });
        }
      } else {
        // Bulk delete
        const deletePromises = Array.from(selectedWorkflows).map((arn) =>
          fetch(`${API_BASE_URL}/state-machines?stateMachineArn=${encodeURIComponent(arn)}`, {
            method: 'DELETE',
          })
        );
        await Promise.all(deletePromises);
        setWorkflows((prev) => prev.filter((w) => !selectedWorkflows.has(w.stateMachineArn)));
        setSelectedWorkflows(new Set());
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Failed to delete workflow(s)');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setWorkflowToDelete(null);
    }
  };

  const loadExecutions = async (workflowArn: string) => {
    setIsLoadingExecutions((prev) => ({ ...prev, [workflowArn]: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/executions?stateMachineArn=${encodeURIComponent(workflowArn)}&maxResults=10`
      );
      const result = await response.json();
      if (response.ok) {
        setWorkflowExecutions((prev) => ({
          ...prev,
          [workflowArn]: result.executions || [],
        }));
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setIsLoadingExecutions((prev) => ({ ...prev, [workflowArn]: false }));
    }
  };

  const toggleWorkflowExpansion = (arn: string) => {
    if (expandedWorkflow === arn) {
      setExpandedWorkflow(null);
    } else {
      setExpandedWorkflow(arn);
      if (!workflowExecutions[arn]) {
        loadExecutions(arn);
      }
    }
  };

  const handleStartExecution = (workflow: Workflow) => {
    setSelectedWorkflowForExecution(workflow);
    setExecutionInput('{}');
    setShowExecutionModal(true);
  };

  const confirmStartExecution = async () => {
    if (!selectedWorkflowForExecution) return;

    setIsStartingExecution(true);
    try {
      let input: unknown = {};
      try {
        input = JSON.parse(executionInput);
      } catch {
        alert('Invalid JSON input');
        setIsStartingExecution(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateMachineArn: selectedWorkflowForExecution.stateMachineArn,
          input,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        // Reload executions
        await loadExecutions(selectedWorkflowForExecution.stateMachineArn);
        setShowExecutionModal(false);
        setSelectedWorkflowForExecution(null);
        // Auto-expand to show new execution
        setExpandedWorkflow(selectedWorkflowForExecution.stateMachineArn);
      } else {
        alert(result.error || 'Failed to start execution');
      }
    } catch (error) {
      console.error('Error starting execution:', error);
      alert('Failed to start execution');
    } finally {
      setIsStartingExecution(false);
    }
  };

  const viewExecutionDetails = async (executionArn: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`);
      const result = await response.json();
      if (response.ok) {
        setSelectedExecution(result);
        setShowExecutionDetails(true);
      }
    } catch (error) {
      console.error('Error loading execution details:', error);
    }
  };

  const handleExport = (workflow: Workflow) => {
    setWorkflowToExport(workflow);
    setShowExportModal(true);
  };

  const confirmExport = () => {
    if (!workflowToExport) return;

    // In a real app, you'd fetch the definition from the API
    const definition = workflowToExport.definition || {};
    const exportData = {
      name: workflowToExport.name,
      stateMachineArn: workflowToExport.stateMachineArn,
      definition,
    };

    const content = exportFormat === 'json'
      ? JSON.stringify(exportData, null, 2)
      : `name: ${workflowToExport.name}\narn: ${workflowToExport.stateMachineArn}\ndefinition:\n  ${JSON.stringify(definition, null, 2).split('\n').join('\n  ')}`;

    const blob = new Blob([content], {
      type: exportFormat === 'json' ? 'application/json' : 'text/yaml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowToExport.name}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    setWorkflowToExport(null);
  };

  const handleStopExecution = async (executionArn: string, workflowArn: string) => {
    setIsStoppingExecution(executionArn);
    try {
      // Note: Backend endpoint needs to be implemented: DELETE /executions/:executionArn
      const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload executions to reflect the stopped status
        await loadExecutions(workflowArn);
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to stop execution');
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      alert('Failed to stop execution. Backend endpoint may not be implemented yet.');
    } finally {
      setIsStoppingExecution(null);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'DELETING':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'bg-green-500/20 text-green-400';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400';
      case 'RUNNING':
        return 'bg-blue-500/20 text-blue-400';
      case 'TIMED_OUT':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'ABORTED':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                FlowBuilder
              </Link>
              <span className="text-sm text-gray-400">Dashboard</span>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium"
            >
              + New Workflow
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Workflows</p>
                <p className="text-3xl font-bold text-white mt-2">{workflows.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active</p>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  {workflows.filter((w) => w.status === 'ACTIVE').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Running Executions</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  {Object.values(workflowExecutions).flat().filter((e) => e.status === 'RUNNING').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Executions</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {Object.values(workflowExecutions).flat().length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="all" className="bg-slate-800">All Status</option>
                <option value="ACTIVE" className="bg-slate-800">Active</option>
                <option value="DELETING" className="bg-slate-800">Deleting</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedWorkflows.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete ({selectedWorkflows.size})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Workflows List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No workflows found</h3>
            <p className="mt-2 text-sm text-gray-400">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by creating a new workflow'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link
                href="/"
                className="mt-6 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium"
              >
                Create Workflow
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.stateMachineArn}
                className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedWorkflows.has(workflow.stateMachineArn)}
                        onChange={() => toggleWorkflowSelection(workflow.stateMachineArn)}
                        className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-600 bg-slate-900 rounded"
                      />

                      {/* Workflow Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(workflow.status)}`}>
                            {workflow.status || 'UNKNOWN'}
                          </span>
                          {workflow.type && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {workflow.type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 font-mono truncate">{workflow.stateMachineArn}</p>
                        <p className="text-sm text-gray-500 mt-1">Created {formatDate(workflow.creationDate)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleStartExecution(workflow)}
                        className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"
                        title="Start Execution"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleExport(workflow)}
                        className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                        title="Export"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(workflow.stateMachineArn)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleWorkflowExpansion(workflow.stateMachineArn)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="View Executions"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${expandedWorkflow === workflow.stateMachineArn ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Executions Panel */}
                  {expandedWorkflow === workflow.stateMachineArn && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-white">Recent Executions</h4>
                        {isLoadingExecutions[workflow.stateMachineArn] && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400"></div>
                        )}
                      </div>
                      {workflowExecutions[workflow.stateMachineArn]?.length > 0 ? (
                        <div className="space-y-2">
                          {workflowExecutions[workflow.stateMachineArn].map((execution) => (
                            <div
                              key={execution.executionArn}
                              className="flex items-center justify-between p-3 bg-slate-900 rounded-lg hover:bg-slate-900/80 transition-colors border border-slate-700"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getExecutionStatusColor(execution.status)}`}>
                                  {execution.status}
                                </span>
                                <span className="text-sm text-gray-300 font-mono truncate">
                                  {execution.name || execution.executionArn.split(':').pop()}
                                </span>
                                <span className="text-xs text-gray-500 ml-auto">
                                  {formatDate(execution.startDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {execution.status === 'RUNNING' && (
                                  <button
                                    onClick={() => handleStopExecution(execution.executionArn, workflow.stateMachineArn)}
                                    disabled={isStoppingExecution === execution.executionArn}
                                    className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    title="Stop Execution"
                                  >
                                    {isStoppingExecution === execution.executionArn ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400"></div>
                                        Stopping...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                        </svg>
                                        Stop
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => viewExecutionDetails(execution.executionArn)}
                                  className="px-3 py-1 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded transition-colors"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No executions yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Workflow{selectedWorkflows.size > 1 ? 's' : ''}?</h3>
            <p className="text-sm text-gray-400 mb-6">
              {selectedWorkflows.size > 1
                ? `Are you sure you want to delete ${selectedWorkflows.size} workflows? This action cannot be undone.`
                : 'Are you sure you want to delete this workflow? This action cannot be undone.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setWorkflowToDelete(null);
                }}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Execution Modal */}
      {showExecutionModal && selectedWorkflowForExecution && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Start Execution</h3>
            <p className="text-sm text-gray-400 mb-4">
              Workflow: <span className="font-mono text-xs text-indigo-400">{selectedWorkflowForExecution.name}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Input (JSON)</label>
              <textarea
                value={executionInput}
                onChange={(e) => setExecutionInput(e.target.value)}
                className="w-full h-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-white placeholder-gray-500 transition-colors"
                placeholder='{"key": "value"}'
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExecutionModal(false);
                  setSelectedWorkflowForExecution(null);
                }}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                disabled={isStartingExecution}
              >
                Cancel
              </button>
              <button
                onClick={confirmStartExecution}
                disabled={isStartingExecution}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isStartingExecution ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Starting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Execution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      {showExecutionDetails && selectedExecution && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Execution Details</h3>
              <button
                onClick={() => {
                  setShowExecutionDetails(false);
                  setSelectedExecution(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400">Status</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getExecutionStatusColor(selectedExecution.status)}`}>
                      {selectedExecution.status}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400">Execution ARN</label>
                  <p className="mt-1 text-sm font-mono text-gray-300 break-all">{selectedExecution.executionArn}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400">Start Date</label>
                  <p className="mt-1 text-sm text-white">{formatDate(selectedExecution.startDate)}</p>
                </div>
                {selectedExecution.stopDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Stop Date</label>
                    <p className="mt-1 text-sm text-white">{formatDate(selectedExecution.stopDate)}</p>
                  </div>
                )}
              </div>
              {selectedExecution.input && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Input</label>
                  <pre className="bg-slate-900 border border-slate-700 p-4 rounded-lg overflow-x-auto text-xs font-mono text-gray-300">
                    {JSON.stringify(selectedExecution.input, null, 2)}
                  </pre>
                </div>
              )}
              {selectedExecution.output && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Output</label>
                  <pre className="bg-slate-900 border border-slate-700 p-4 rounded-lg overflow-x-auto text-xs font-mono text-gray-300">
                    {JSON.stringify(selectedExecution.output, null, 2)}
                  </pre>
                </div>
              )}
              {selectedExecution.error && (
                <div>
                  <label className="text-sm font-medium text-red-400 mb-2 block">Error</label>
                  <pre className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg overflow-x-auto text-xs font-mono text-red-400">
                    {selectedExecution.error}
                  </pre>
                </div>
              )}
              {selectedExecution.cause && (
                <div>
                  <label className="text-sm font-medium text-red-400 mb-2 block">Cause</label>
                  <pre className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg overflow-x-auto text-xs font-mono text-red-400">
                    {selectedExecution.cause}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && workflowToExport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Workflow</h3>
            <p className="text-sm text-gray-400 mb-4">
              Export <span className="font-mono text-xs text-indigo-400">{workflowToExport.name}</span> in your preferred format.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Format</label>
              <div className="flex gap-4">
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                    className="mr-2 text-indigo-600"
                  />
                  JSON
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="yaml"
                    checked={exportFormat === 'yaml'}
                    onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                    className="mr-2 text-indigo-600"
                  />
                  YAML
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setWorkflowToExport(null);
                }}
                className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

