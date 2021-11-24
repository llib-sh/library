const concat = require('gulp-concat');
const rename = require("gulp-rename");
const gulp = require('gulp');
const uglify = require('gulp-uglify');

gulp.task('min', function() {
  return gulp.src(['./test/js/*.js'])
    .pipe(concat('library.js'))
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('all', function() {
  return gulp.src(['./test/js/*.js'])
    .pipe(concat('library.js'))
    .pipe(gulp.dest('./dist/'));
});

// function defaultTask(cb) {
//   // place code for your default task here
//   cb();
// }
//
// exports.default = defaultTask
