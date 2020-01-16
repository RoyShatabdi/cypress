const { EventEmitter } = require('events')
const _ = Cypress._

const itHandlesFileOpening = (containerSelector) => {
  beforeEach(function () {
    cy.stub(this.runner, 'emit').callThrough()
    this.setError(this.commandErr)
    cy.contains('View stack trace').click()
  })

  describe('when user has already set opener and open file', function () {
    beforeEach(function () {
      this.editor = {}

      this.runner.emit.withArgs('get:user:editor').yields({
        preferredOpener: this.editor,
      })
    })

    it('opens in preferred opener', function () {
      cy.get(`${containerSelector} a`).first().click().then(() => {
        expect(this.runner.emit).to.be.calledWith('open:file', {
          where: this.editor,
          file: '/me/dev/my/app.js',
          line: 2,
          column: 7,
        })
      })
    })
  })

  describe('when user has not already set opener and opens file', function () {
    const availableEditors = [
      { id: 'computer', name: 'On Computer', isOther: false, openerId: 'computer' },
      { id: 'atom', name: 'Atom', isOther: false, openerId: 'atom' },
      { id: 'vim', name: 'Vim', isOther: false, openerId: 'vim' },
      { id: 'sublime', name: 'Sublime Text', isOther: false, openerId: 'sublime' },
      { id: 'vscode', name: 'Visual Studio Code', isOther: false, openerId: 'vscode' },
      { id: 'other', name: 'Other', isOther: true, openerId: '' },
    ]

    beforeEach(function () {
      this.runner.emit.withArgs('get:user:editor').yields({ availableEditors })
      // usual viewport of only reporter is a bit cramped for the modal
      cy.viewport(600, 600)
      cy.get(`${containerSelector} a`).first().click()
    })

    it('opens modal with available editors', function () {
      _.each(availableEditors, ({ name }) => {
        cy.contains(name)
      })

      cy.contains('Other')
      cy.contains('Set editor and open file')
    })

    // NOTE: this fails because mobx doesn't make the editors observable, so
    // the changes to the path don't bubble up correctly. this only happens
    // in the Cypress test and not when running the actual app
    it.skip('updates "Other" path when typed into', function () {
      cy.contains('Other').find('input[type="text"]').type('/path/to/editor')
      .should('have.value', '/path/to/editor')
    })

    it('does not show error message when first shown', function () {
      cy.contains('Please select a preference').should('not.exist')
    })

    it('shows error message when user clicks "Set editor and open file" without selecting an editor', function () {
      cy.contains('Set editor and open file').click()

      cy.contains('Set editor and open file').should('be.visible')
      cy.wrap(this.runner.emit).should('not.to.be.calledWith', 'set:user:editor')
      cy.wrap(this.runner.emit).should('not.to.be.calledWith', 'open:file')

      cy.get('.validation-error').should('have.text', 'Please select a preference')
    })

    it('shows error message when user selects "Other" and does not input path', function () {
      cy.contains('Other').click()
      cy.contains('Set editor and open file').click()

      cy.contains('Set editor and open file').should('be.visible')
      cy.wrap(this.runner.emit).should('not.to.be.calledWith', 'set:user:editor')
      cy.wrap(this.runner.emit).should('not.to.be.calledWith', 'open:file')

      cy.get('.validation-error').should('have.text', 'Please enter the path to your editor')
    })

    it('hides error message when submitting "Other" then selecting different option', function () {
      cy.contains('Other').click()
      cy.contains('Set editor and open file').click()

      cy.get('.validation-error').should('have.text', 'Please enter the path to your editor')
      cy.contains('Atom').click()
      cy.get('.validation-error').should('not.exist')
    })

    describe('when editor is set', function () {
      beforeEach(function () {
        cy.contains('Visual Studio Code').click()
        cy.contains('Set editor and open file').click()
      })

      it('closes modal', function () {
        cy.contains('Set editor and open file').should('not.be.visible')
      })

      it('emits set:user:editor', function () {
        expect(this.runner.emit).to.be.calledWith('set:user:editor', availableEditors[4])
      })

      it('opens file in selected editor', function () {
        expect(this.runner.emit).to.be.calledWith('open:file', {
          where: availableEditors[4],
          file: '/me/dev/my/app.js',
          line: 2,
          column: 7,
        })
      })
    })
  })
}

describe('test errors', function () {
  beforeEach(function () {
    cy.fixture('runnables_error').as('runnablesErr')

    this.commandErr = {
      name: 'CommandError',
      message: '`foo` \\`bar\\` **baz** *fizz* ** buzz **',
      mdMessage: '`cy.check()` can only be called on `:checkbox` and `:radio`. Your subject contains a: `<form id=\"by-id\">...</form>`',
      stack: `Some Error
        at foo.bar (my/app.js:2:7)
          at baz.qux (cypress/integration/foo_spec.js:5:2)
      From previous event:
        at bar.baz (my/app.js:8:11)
      `,
      parsedStack: [{
        message: 'Some Error',
      }, {
        relativeFile: 'my/app.js',
        absoluteFile: '/me/dev/my/app.js',
        function: 'foo.bar',
        line: 2,
        column: 7,
        whitespace: '  ',
      }, {
        relativeFile: 'cypress/integration/foo_spec.js',
        absoluteFile: '/me/dev/cypress/integration/foo_spec.js',
        function: 'baz.qux',
        line: 5,
        column: 2,
        whitespace: '    ',
      }, {
        message: 'At previous event:',
        whitespace: '  ',
      }, {
        relativeFile: 'my/app.js',
        absoluteFile: '/me/dev/my/app.js',
        function: 'bar.baz',
        line: 8,
        column: 11,
        whitespace: '    ',
      }],
      docsUrl: 'https://on.cypress.io/type',
      codeFrame: {
        relativeFile: 'my/app.js',
        absoluteFile: '/me/dev/my/app.js',
        line: 2,
        column: 7,
        language: 'javascript',
        frame: 'cy.get(\'.as - table\')\n.find(\'tbody>tr\').eq(12)\n.find(\'td\').first()\n.find(\'button\').as(\'firstBtn\')\n.then(() => { })',
      },
    }

    this.setError = function (err) {
      this.runnablesErr.suites[0].tests[0].err = err

      cy.get('.reporter').then(() => {
        this.runner.emit('runnables:ready', this.runnablesErr)

        this.runner.emit('reporter:start', {})
      })
    }

    this.runner = new EventEmitter()

    cy.visit('cypress/support/index.html').then((win) => {
      win.render({
        runner: this.runner,
        specPath: '/foo/bar',
        config: {
          projectRoot: '/root',
        },
      })
    })
  })

  describe('print to console', function () {
    beforeEach(function () {
      this.setError(this.commandErr)
    })

    it('hovering shows tooltip', function () {
      cy.get('.runnable-err-print').trigger('mouseover')
      cy.get('.tooltip').should('have.text', 'Print error to console')
    })

    it('clicking prints to console', function () {
      cy.spy(this.runner, 'emit')
      cy.get('.runnable-err-print').click().then(() => {
        expect(this.runner.emit).to.be.calledWith('runner:console:error', {
          commandId: undefined,
          testId: 'r3',
        })
      })
    })
  })

  describe('stack trace', function () {
    it('hides stack trace by default', function () {
      this.setError(this.commandErr)

      cy.get('.runnable-err-stack-trace').should('not.be.visible')
    })

    it('opens stack trace on click', function () {
      this.setError(this.commandErr)

      cy.contains('View stack trace').click()
      cy.get('.runnable-err-stack-trace').should('be.visible')
    })

    it('pairs down stack line whitespace', function () {
      this.setError(this.commandErr)
      cy.contains('View stack trace').click()

      cy.get('.runnable-err-stack-trace').within(() => {
        cy.get('.err-stack-line')
        .should('have.length', 4)
        .first().should('have.text', 'at foo.bar (my/app.js:2:7)')

        cy.get('.err-stack-line')
        .eq(1).should('have.text', '  at baz.qux (cypress/integration/foo_spec.js:5:2)')

        cy.get('.err-stack-line')
        .eq(2).should('have.text', 'At previous event:')

        cy.get('.err-stack-line')
        .eq(3).should('have.text', '  at bar.baz (my/app.js:8:11)')
      })
    })

    it('does not include message in stack trace', function () {
      this.setError(this.commandErr)

      cy.contains('View stack trace').click()
      cy.get('.runnable-err-stack-trace')
      .invoke('text')
      .should('not.include', 'Some Error')
    })

    it('turns files into links', function () {
      this.setError(this.commandErr)

      cy.get('.runnable-err-stack-trace .runnable-err-file-path')
      .should('have.length', 3)
      .first()
      .should('have.text', 'my/app.js:2:7')

      cy.contains('View stack trace').click()
      cy.get('.runnable-err-stack-trace .runnable-err-file-path').eq(1)
      .should('have.text', 'cypress/integration/foo_spec.js:5:2')
    })

    itHandlesFileOpening('.runnable-err-stack-trace')
  })

  describe('command error', function () {
    it('shows error name', function () {
      this.setError(this.commandErr)

      cy.get('.runnable-err-name').should('contain', this.commandErr.name)
    })

    it('renders and escapes markdown', function () {
      this.setError(this.commandErr)

      cy.get('.runnable-err-message')

      // renders `foo` as <code>foo</code>
      .contains('code', 'foo')
      .and('not.contain', '`foo`')

      // renders /`bar/` as `bar`
      cy.get('.runnable-err-message')
      .should('contain', '`bar`')

      // renders **baz** as <strong>baz</strong>
      cy.get('.runnable-err-message')
      .contains('strong', 'baz')
      .and('not.contain', '**baz**')

      // renders *fizz* as <em>fizz</em>
      cy.get('.runnable-err-message')
      .contains('em', 'fizz')
      .and('not.contain', '*fizz*')
    })

    // NOTE: still needs to be implemented
    it.skip('renders and escapes markdown with leading/trailing whitespace', () => {
      cy.get('.runnable-err-message')

      // https://github.com/cypress-io/cypress/issues/1360
      // renders ** buzz ** as <strong> buzz </strong>
      .contains('code', 'foo')
      .and('not.contain', '`foo`')
    })
  })

  describe('code frames', function () {
    it('shows code frame when included on error', function () {
      this.setError(this.commandErr)

      cy
      .get('.test-err-code-frame')
      .should('be.visible')
    })

    it('does not show code frame when not included on error', function () {
      this.commandErr.codeFrame = undefined
      this.setError(this.commandErr)

      cy
      .get('.test-err-code-frame')
      .should('not.be.visible')
    })

    it('use correct language class', function () {
      this.setError(this.commandErr)

      cy
      .get('.test-err-code-frame pre')
      .should('have.class', 'language-javascript')
    })

    it('falls back to text language class', function () {
      this.commandErr.codeFrame.language = null
      this.setError(this.commandErr)

      cy
      .get('.test-err-code-frame pre')
      .should('have.class', 'language-text')
    })

    itHandlesFileOpening('.test-err-code-frame')
  })
})