-- Adiciona a coluna para suportar exercícios alternativos
ALTER TABLE workout_exercises 
ADD COLUMN parent_exercise_id UUID REFERENCES workout_exercises(id) ON DELETE CASCADE;
