'use client'
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Search, Trash2, GripVertical, Calendar, ChevronLeft, ChevronRight,
  Plus, Edit3, X, Save, ArrowLeft, Dumbbell, User, Clock
} from 'lucide-react';
import { apiFetch } from '../api/client';
import workoutAPI from '../api/workout-api';
import exerciseApi from '../api/exercise-api';
import verificationApi from '../api/verification-api';

// Helper to extract gymId from trainer object (handles multiple structures)
const getGymId = (trainer) => {
  if (!trainer) return null;

  // Direct gymId on trainer
  if (trainer.gymId) return trainer.gymId;

  // From gyms array
  if (trainer.gyms && Array.isArray(trainer.gyms) && trainer.gyms.length > 0) {
    const firstGym = trainer.gyms[0];
    return firstGym.gymId || firstGym.id || firstGym;
  }

  // From gym object
  if (trainer.gym) {
    return trainer.gym.gymId || trainer.gym.id || trainer.gym;
  }

  return null;
};

const WorkoutSchedulePlanner = ({ trainer }) => {
  // Athletes list state
  const [athletes, setAthletes] = useState([]);
  const [athleteNames, setAthleteNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  // Workout planner state
  const [workoutPlan, setWorkoutPlan] = useState({});
  const [draggedExercise, setDraggedExercise] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [weekDates, setWeekDates] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());

  // Exercise library state
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);

  // Edit modal state
  const [editingExercise, setEditingExercise] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [editFormData, setEditFormData] = useState({
    reps: 15,
    sets: 3,
    weight: 0,
    notes: ''
  });

  // Fetch athletes on mount
  useEffect(() => {
    fetchAthletes();
    fetchMuscleGroups();
    fetchExercises();
  }, []);

  // Update week dates
  useEffect(() => {
    updateWeekDates(currentWeekStart);
  }, [currentWeekStart]);

  // Fetch workout when athlete changes
  useEffect(() => {
    if (selectedAthlete) {
      fetchWorkoutPlan();
    }
  }, [selectedAthlete, currentWeekStart]);

  const fetchAthletes = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/trainer-app/clients');

      if (!response.ok) throw new Error('Failed to fetch athletes');

      const data = await response.json();
      const fetchedAthletes = data.data || [];
      setAthletes(fetchedAthletes);

      // Fetch names for all athletes
      if (fetchedAthletes.length > 0) {
        const namesMap = {};
        await Promise.all(
          fetchedAthletes.map(async (athlete) => {
            const id = athlete.id;
            if (id) {
              try {
                const name = await verificationApi.getUserName(id);
                if (name) namesMap[id] = name;
              } catch (e) {
                console.error(`Failed to fetch name for ${id}`, e);
              }
            }
          })
        );
        setAthleteNames(namesMap);
      }
    } catch (error) {
      console.error('Error fetching athletes:', error);
      toast.error('Failed to load athletes');
    } finally {
      setLoading(false);
    }
  };

  const fetchMuscleGroups = async () => {
    try {
      const data = await exerciseApi.getAllMuscles();
      setMuscleGroups(
        data.map(m => ({
          id: m.muscle_id,
          name: m.name,
          color: 'bg-gray-100 border-gray-300'
        }))
      );
    } catch (err) {
      console.error('Error fetching muscles:', err);
    }
  };

  const fetchExercises = async () => {
    try {
      const data = await exerciseApi.getAllExercises();
      setExerciseLibrary(
        data
          .filter(ex => ex.exercise_name)
          .map(ex => ({
            id: ex.exercise_id,
            name: ex.exercise_name,
            muscleId: ex.muscle_id,
            muscle: ex.muscle_name,
            image: ex.image || ''
          }))
      );
    } catch (err) {
      console.error('Error fetching exercises:', err);
    }
  };

  const fetchWorkoutPlan = async () => {
    if (!selectedAthlete || !trainer?.organizationId) return;

    try {
      const gymId = getGymId(trainer);
      if (!gymId) {
        console.error('No gymId found in trainer data:', trainer);
        return;
      }

      const planData = await workoutAPI.getWorkoutPlan(
        selectedAthlete.id,
        trainer.organizationId,
        gymId
      );

      if (planData.workouts && Object.keys(planData.workouts).length > 0) {
        setWorkoutPlan(planData.workouts);
      } else {
        setWorkoutPlan({});
      }
    } catch (error) {
      console.error('Error fetching workout plan:', error);
      setWorkoutPlan({});
    }
  };

  const updateWeekDates = (referenceDate) => {
    const dates = workoutAPI.getWeekDates(referenceDate);
    setWeekDates(dates);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(new Date());
  };

  // Enrich athletes with names
  const enrichedAthletes = useMemo(() => {
    return athletes.map(athlete => ({
      ...athlete,
      name: athlete.name || athleteNames[athlete.id] || null
    }));
  }, [athletes, athleteNames]);

  // Filter athletes by search
  const filteredAthletes = enrichedAthletes.filter(athlete => {
    const name = athlete.name || '';
    const email = athlete.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Filter exercises
  const filteredExercises = exerciseLibrary.filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase());
    const matchesMuscle = selectedMuscle === 'all' || exercise.muscleId === parseInt(selectedMuscle);
    return matchesSearch && matchesMuscle;
  });

  // Drag and drop handlers
  const handleDragStart = (e, exercise) => {
    setDraggedExercise(exercise);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!selectedAthlete || !draggedExercise) return;

    const tempInstanceId = `temp_${Date.now()}`;
    const exerciseWithTemp = {
      ...draggedExercise,
      instanceId: tempInstanceId,
      addedAt: new Date().toISOString(),
      reps: 15,
      sets: 3,
      weight: 0
    };

    setWorkoutPlan(prev => {
      const updated = { ...prev };
      if (!updated[dateStr]) {
        updated[dateStr] = [];
      } else if (!Array.isArray(updated[dateStr])) {
        updated[dateStr] = getExercisesForDate(dateStr);
      }
      updated[dateStr] = [...updated[dateStr], exerciseWithTemp];
      return updated;
    });

    await saveToFirebase(dateStr, draggedExercise, tempInstanceId);
    setDraggedExercise(null);
  };

  const saveToFirebase = async (dateStr, exercise, tempInstanceId) => {
    if (!selectedAthlete || !trainer?.organizationId) return;

    const gymId = getGymId(trainer);
    if (!gymId) {
      console.error('No gymId found in trainer data:', trainer);
      toast.error('Gym configuration missing. Please contact support.');
      return;
    }

    setSaveStatus('saving');

    try {
      const result = await workoutAPI.addExercise(
        selectedAthlete.id,
        trainer.organizationId,
        gymId,
        dateStr,
        exercise
      );

      if (result.instanceId) {
        setWorkoutPlan(prev => {
          const updated = { ...prev };
          if (updated[dateStr]) {
            updated[dateStr] = updated[dateStr].map(ex =>
              ex.instanceId === tempInstanceId
                ? { ...ex, instanceId: result.instanceId }
                : ex
            );
          }
          return updated;
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving workout:', error);
      setSaveStatus('error');
      setWorkoutPlan(prev => {
        const updated = { ...prev };
        if (updated[dateStr]) {
          updated[dateStr] = updated[dateStr].filter(ex => ex.instanceId !== tempInstanceId);
        }
        return updated;
      });
    }
  };

  const removeExercise = async (dateStr, instanceId) => {
    if (!selectedAthlete || !trainer?.organizationId) return;

    const gymId = getGymId(trainer);
    if (!gymId) {
      toast.error('Gym configuration missing');
      return;
    }

    try {
      await workoutAPI.removeExercise(
        selectedAthlete.id,
        trainer.organizationId,
        gymId,
        dateStr,
        instanceId
      );

      setWorkoutPlan(prev => {
        const updated = { ...prev };
        if (updated[dateStr]) {
          updated[dateStr] = updated[dateStr].filter(ex => ex.instanceId !== instanceId);
        }
        return updated;
      });

      toast.success('Exercise removed');
    } catch (error) {
      console.error('Error removing exercise:', error);
      toast.error('Failed to remove exercise');
    }
  };

  // Edit exercise functions
  const openEditModal = (exercise, dateStr) => {
    setEditingExercise(exercise);
    setEditingDate(dateStr);
    setEditFormData({
      reps: exercise.reps || 15,
      sets: exercise.sets || 3,
      weight: exercise.weight || 0,
      notes: exercise.notes || ''
    });
  };

  const closeEditModal = () => {
    setEditingExercise(null);
    setEditingDate(null);
    setEditFormData({ reps: 15, sets: 3, weight: 0, notes: '' });
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: field === 'notes' ? value : parseInt(value) || 0
    }));
  };

  const saveExerciseEdit = async () => {
    if (!editingExercise || !editingDate || !selectedAthlete) return;

    const gymId = getGymId(trainer);
    if (!gymId) {
      toast.error('Gym configuration missing');
      return;
    }

    try {
      await workoutAPI.updateExercise(
        selectedAthlete.id,
        trainer.organizationId,
        gymId,
        editingDate,
        editingExercise.instanceId,
        editFormData
      );

      setWorkoutPlan(prev => {
        const updated = { ...prev };
        if (updated[editingDate]) {
          updated[editingDate] = updated[editingDate].map(ex =>
            ex.instanceId === editingExercise.instanceId
              ? { ...ex, ...editFormData }
              : ex
          );
        }
        return updated;
      });

      toast.success('Exercise updated');
      closeEditModal();
    } catch (error) {
      console.error('Error updating exercise:', error);
      toast.error('Failed to update exercise');
    }
  };

  const getMuscleColor = (muscleId) => {
    return muscleGroups.find(m => m.id === muscleId)?.color || 'bg-gray-100 border-gray-300';
  };

  const getMuscleName = (muscleId) => {
    return muscleGroups.find(m => m.id === muscleId)?.name || 'Unknown';
  };

  const getExercisesForDate = (dateStr) => {
    const data = workoutPlan[dateStr];
    if (!data) return [];
    if (Array.isArray(data)) return data;

    const allExercises = [];
    Object.entries(data).forEach(([muscleId, exArray]) => {
      if (Array.isArray(exArray)) {
        exArray.forEach(ex => {
          allExercises.push({
            ...ex,
            muscleId: parseInt(muscleId),
            instanceId: ex.instanceId || `legacy_${ex.id}_${muscleId}`
          });
        });
      }
    });
    return allExercises;
  };

  const getTotalExercisesForDate = (dateStr) => {
    return getExercisesForDate(dateStr).length;
  };

  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getWeekRangeDisplay = () => {
    if (weekDates.length === 0) return '';
    const start = new Date(weekDates[0].date);
    const end = new Date(weekDates[6].date);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // If an athlete is selected, show the workout planner
  if (selectedAthlete) {
    const athleteName = selectedAthlete.name || athleteNames[selectedAthlete.id] || 'Unknown Athlete';

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedAthlete(null);
                setWorkoutPlan({});
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Workout Plan</h2>
              <p className="text-gray-500">Creating plan for <span className="font-semibold text-emerald-600">{athleteName}</span></p>
            </div>
          </div>

          {saveStatus && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
              saveStatus === 'saving' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Exercise Library */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 h-fit lg:sticky lg:top-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Exercise Library</h3>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={exerciseSearchTerm}
                  onChange={(e) => setExerciseSearchTerm(e.target.value)}
                  className="w-full text-black pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-4">
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
                className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Muscle Groups</option>
                {muscleGroups.map(muscle => (
                  <option key={muscle.id} value={muscle.id}>{muscle.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredExercises.map(exercise => (
                <div
                  key={exercise.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, exercise)}
                  className="bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:bg-gray-100 hover:border-emerald-300 transition-colors overflow-hidden"
                >
                  {exercise.image ? (
                    <img src={exercise.image} alt={exercise.name} className="w-full h-20 object-cover" />
                  ) : (
                    <div className="w-full h-20 bg-gray-200 flex items-center justify-center">
                      <Dumbbell className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="p-2">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{exercise.name}</div>
                        <div className="text-xs text-gray-500">{exercise.muscle}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Section */}
          <div className="lg:col-span-9">
            {/* Week Navigation */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Calendar</h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="font-semibold text-gray-900 text-sm min-w-[180px] text-center">
                      {getWeekRangeDisplay()}
                    </span>
                    <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <button
                    onClick={goToCurrentWeek}
                    className="px-4 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium transition"
                  >
                    Today
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  Total: {weekDates.reduce((sum, day) => sum + getTotalExercisesForDate(day.date), 0)} exercises
                </div>
              </div>
            </div>

            {/* Week Grid */}
            <div className="flex gap-3 overflow-x-auto pb-4">
              {weekDates.map((day) => {
                const dayExercises = getExercisesForDate(day.date);

                return (
                  <div
                    key={day.date}
                    className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-emerald-300 transition-colors flex-shrink-0 w-48 sm:w-56"
                  >
                    <div className={`p-3 text-center ${
                      day.isToday ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-900'
                    }`}>
                      <div className="font-bold text-sm">{day.dayShort.toUpperCase()}</div>
                      <div className={`text-xs ${day.isToday ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {formatDisplayDate(day.date)}
                      </div>
                      <div className="text-xs mt-1">{getTotalExercisesForDate(day.date)} exercises</div>
                    </div>

                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day.date)}
                      className="p-2 min-h-[280px] bg-gray-50 border-2 border-dashed border-gray-300 m-2 rounded-lg transition-all hover:border-emerald-400 hover:bg-emerald-50"
                    >
                      {dayExercises.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
                          <Plus className="w-8 h-8 mb-2" />
                          <span className="text-xs text-center">Drop exercises here</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayExercises.map((exercise, idx) => (
                            <div
                              key={exercise.instanceId || idx}
                              className={`rounded-lg shadow-sm text-xs group relative overflow-hidden border-2 ${getMuscleColor(exercise.muscleId)}`}
                            >
                              <div className="flex items-center gap-2 p-2 bg-white">
                                {exercise.image ? (
                                  <img src={exercise.image} alt={exercise.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <Dumbbell className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-800 truncate text-xs">{exercise.name}</div>
                                  <div className="text-xs text-gray-500">{exercise.muscle || getMuscleName(exercise.muscleId)}</div>
                                  <div className="text-xs text-emerald-600 mt-0.5">
                                    {exercise.sets || 3}x{exercise.reps || 15} {exercise.weight > 0 && `@ ${exercise.weight}kg`}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={() => openEditModal(exercise, day.date)}
                                    className="bg-blue-50 rounded p-1 hover:bg-blue-100"
                                    title="Edit exercise"
                                  >
                                    <Edit3 className="h-3 w-3 text-blue-500" />
                                  </button>
                                  <button
                                    onClick={() => removeExercise(day.date, exercise.instanceId)}
                                    className="bg-red-50 rounded p-1 hover:bg-red-100"
                                    title="Remove exercise"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Edit Exercise Modal */}
        {editingExercise && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Edit Exercise</h3>
                <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {editingExercise.image ? (
                    <img src={editingExercise.image} alt={editingExercise.name} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{editingExercise.name}</div>
                    <div className="text-sm text-gray-500">{editingExercise.muscle || getMuscleName(editingExercise.muscleId)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sets</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={editFormData.sets}
                      onChange={(e) => handleEditFormChange('sets', e.target.value)}
                      className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reps</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editFormData.reps}
                      onChange={(e) => handleEditFormChange('reps', e.target.value)}
                      className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={editFormData.weight}
                      onChange={(e) => handleEditFormChange('weight', e.target.value)}
                      className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => handleEditFormChange('notes', e.target.value)}
                    placeholder="Add instructions or notes..."
                    rows={3}
                    className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveExerciseEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Athletes List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Workout Planner</h2>
        <p className="text-gray-500 mt-1">Select an athlete to create their workout plan</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search athletes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Athletes List */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading athletes...</p>
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {searchTerm ? 'No athletes found matching your search' : 'No athletes assigned yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Athlete</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAthletes.map((athlete) => (
                  <tr key={athlete.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 block">
                            {athlete.name || 'Unknown Athlete'}
                          </span>
                          <span className="text-xs text-gray-400">ID: {athlete.id?.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                        {athlete.batch || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {athlete.email || '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setSelectedAthlete(athlete)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                      >
                        <Dumbbell className="w-4 h-4" />
                        Create Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutSchedulePlanner;
